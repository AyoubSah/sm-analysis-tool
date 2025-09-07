# app/fb_scraper.py
import re
import math
import asyncio
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse, parse_qs
import httpx

FB_API_VERSION = "v19.0"
FB_API_BASE = f"https://graph.facebook.com/{FB_API_VERSION}"

# --- Exceptions ---
class FacebookError(Exception):
    """Base class for Facebook Graph API errors."""


class InvalidTokenError(FacebookError):
    """Raised when the access token is invalid or expired."""


class PageNotFoundError(FacebookError):
    """Raised when the requested page/alias/resource cannot be found."""


class PermissionError(FacebookError):
    """Raised when the token lacks permission to access the resource."""


class RateLimitError(FacebookError):
    """Raised when rate limits are hit and retries are exhausted."""


class ServerError(FacebookError):
    """Raised for 5xx server errors when retries are exhausted."""


class GraphAPIError(FacebookError):
    """Generic Graph API error wrapper containing the original payload."""

# --- Utilities ---
def normalize_page(page: str) -> str:
    page = page.strip()
    if page.startswith("http"):
        parsed = urlparse(page)
        q = parse_qs(parsed.query)
        if q.get("id"):
            return q["id"][0]
        parts = [p for p in parsed.path.split("/") if p]
        if parts:
            return parts[-1]
    return page

def sanitize_text(s: Optional[str]) -> str:
    if not s:
        return ""
    # remove urls, handles, reduce whitespace
    s = re.sub(r"https?://\S+", "", s)
    s = re.sub(r"[@#]\S+", "", s)
    s = re.sub(r"[\u200B-\u200D\uFEFF]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

async def _fb_get(client: httpx.AsyncClient, url: str, params: Optional[dict] = None, retries: int = 3) -> Dict[str, Any]:
    """
    Performs GET with basic retry & backoff for rate limits.
    `url` can be a full url (paging.next) or a path like '/{page_id}/posts'
    """
    full_url = url if url.startswith("http") else FB_API_BASE + url

    try:
        r = await client.get(full_url, params=params, timeout=30.0)
    except httpx.RequestError as e:
        # network-level issue
        raise GraphAPIError(f"Network error while requesting {full_url}: {e}") from e

    # try to parse json body if present
    try:
        data = r.json()
    except Exception:
        data = None

    # If Graph API returned an error payload (some errors are returned with 200), handle it
    if isinstance(data, dict) and "error" in data:
        err = data.get("error", {})
        status = r.status_code
        err_code = err.get("code")
        err_subcode = err.get("error_subcode")
        err_type = err.get("type")
        message = err.get("message") or "Facebook Graph API error"

        # invalid/expired token
        if err_code == 190 or err_type == "OAuthException" or status == 401:
            raise InvalidTokenError(message)

        # page/alias/resource not found
        if status == 404 or err_code == 803 or (isinstance(message, str) and "Unsupported get request" in message):
            raise PageNotFoundError(message)

        # permission issues
        if status == 403 or err_code in (200, 10):
            raise PermissionError(message)

        # rate limiting — try retrying first
        if status == 429 or err_code in (4, 613):
            if retries > 0:
                await asyncio.sleep(2 ** (4 - retries))
                return await _fb_get(client, url, params=params, retries=retries - 1)
            raise RateLimitError(message)

        # server-side errors
        if status >= 500:
            if retries > 0:
                await asyncio.sleep(2 ** (4 - retries))
                return await _fb_get(client, url, params=params, retries=retries - 1)
            raise ServerError(message)

        # fallback for other Graph API errors
        raise GraphAPIError({"status": status, "error": err})

    # If HTTP status indicates failure (and we didn't get an 'error' payload above), use httpx's raise
    try:
        r.raise_for_status()
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        # attempt to extract error info
        try:
            err_json = e.response.json()
            err = err_json.get("error", {})
            err_code = err.get("code")
            message = err.get("message") or str(err_json)
        except Exception:
            err_code = None
            message = str(e)

        # same handling as above
        if err_code == 190 or status == 401:
            raise InvalidTokenError(message)
        if status == 404 or err_code == 803:
            raise PageNotFoundError(message)
        if status == 403 or err_code in (200, 10):
            raise PermissionError(message)
        if status == 429 or err_code in (4, 613):
            if retries > 0:
                await asyncio.sleep(2 ** (4 - retries))
                return await _fb_get(client, url, params=params, retries=retries - 1)
            raise RateLimitError(message)
        if status >= 500:
            if retries > 0:
                await asyncio.sleep(2 ** (4 - retries))
                return await _fb_get(client, url, params=params, retries=retries - 1)
            raise ServerError(message)

        raise GraphAPIError({"status": status, "message": message})

    # success
    return data

# --- Graph helpers ---
async def resolve_page_id(page: str, access_token: str) -> str:
    page_norm = normalize_page(page)
    if page_norm.isdigit():
        return page_norm
    async with httpx.AsyncClient() as client:
        data = await _fb_get(client, f"/{page_norm}", params={"fields": "id", "access_token": access_token})
        if "id" not in data:
            raise ValueError("Could not resolve page id from: " + page)
        return str(data["id"])

async def fetch_posts(client: httpx.AsyncClient, page_id: str, access_token: str,
                      limit: Optional[int] = None, since: Optional[str] = None, until: Optional[str] = None) -> List[Dict[str, Any]]:
    """Fetch posts for a page.

    If `limit` is None the function will page through all available posts (requesting up to 100 per request).
    If `limit` is provided the total posts returned will be capped to that value.
    """
    fields = "id,created_time,message,permalink_url"
    # When limit is None, request 100 per page to be efficient; otherwise request up to min(limit, 100)
    params = {"fields": fields, "access_token": access_token}
    if limit is None:
        params["limit"] = 100
    else:
        params["limit"] = min(limit, 100)
    if since: params["since"] = since
    if until: params["until"] = until

    url = f"/{page_id}/posts"
    posts: List[Dict[str, Any]] = []
    while True:
        data = await _fb_get(client, url, params=params)
        posts.extend(data.get("data", []))
        # stop if we reached the requested limit (when provided)
        if limit is not None and len(posts) >= limit:
            break
        next_url = data.get("paging", {}).get("next")
        if not next_url:
            break
        url = next_url
        params = None  # when following next, url already contains token & params
    return posts if limit is None else posts[:limit]

async def fetch_comments_for_post(client: httpx.AsyncClient, post_id: str, access_token: str,
                                  max_comments: Optional[int] = None) -> List[Dict[str, Any]]:
    """Fetch comments for a single post.

    If `max_comments` is None the function will page through all available comments (requesting up to 100 per request).
    If `max_comments` is provided the total comments returned will be capped to that value.
    """
    fields = "id,from,message,created_time"
    params = {"fields": fields, "access_token": access_token, "filter": "stream"}
    if max_comments is None:
        params["limit"] = 100
    else:
        params["limit"] = min(max_comments, 100)
    url = f"/{post_id}/comments"
    comments: List[Dict[str, Any]] = []
    while True:
        data = await _fb_get(client, url, params=params)
        comments.extend(data.get("data", []))
        # stop if we reached the requested cap (when provided)
        if max_comments is not None and len(comments) >= max_comments:
            break
        next_url = data.get("paging", {}).get("next")
        if not next_url:
            break
        url = next_url
        params = None
    return comments if max_comments is None else comments[:max_comments]

# --- Top-level orchestrator ---
async def fetch_all_comments(page: str, access_token: str,
                             max_posts: int = 10, max_comments: int = 500,
                             since: Optional[str] = None, until: Optional[str] = None,
                             concurrency: int = 3) -> Dict[str, Any]:
    """
    Returns: { page_id, posts_scanned, total_fetched, comments: [ {comment_id, post_id, text, author_id, author_name, created_time} ] }
    """
    async with httpx.AsyncClient() as client:
        page_id = await resolve_page_id(page, access_token)
        posts = await fetch_posts(client, page_id, access_token, limit=max_posts, since=since, until=until)
        posts_scanned = len(posts)

        if posts_scanned == 0:
            return {"page_id": page_id, "posts_scanned": 0, "total_fetched": 0, "comments": []}

        per_post = max(1, math.ceil(max_comments / posts_scanned))
        sem = asyncio.Semaphore(concurrency)

        async def _fetch_for_post(post):
            async with sem:
                pid = post.get("id")
                try:
                    raw = await fetch_comments_for_post(client, pid, access_token, max_comments=per_post)
                except Exception as e:
                    # log & return empty list for this post
                    print(f"[warn] failed comments for post {pid}: {e}")
                    return []
                out = []
                for c in raw:
                    text = sanitize_text(c.get("message"))
                    if not text:
                        continue
                    out.append({
                        "comment_id": c.get("id"),
                        "post_id": pid,
                        "text": text,
                        "author_id": (c.get("from") or {}).get("id"),
                        "author_name": (c.get("from") or {}).get("name"),
                        "created_time": c.get("created_time")
                    })
                return out

        tasks = [asyncio.create_task(_fetch_for_post(p)) for p in posts]
        results = await asyncio.gather(*tasks)
        flat = [item for sub in results for item in sub]

        # dedupe by comment_id, preserve first occurrence
        seen = {}
        unique = []
        for c in flat:
            cid = c["comment_id"]
            if cid not in seen:
                seen[cid] = True
                unique.append(c)

        return {
            "page_id": page_id,
            "posts_scanned": posts_scanned,
            "total_fetched": len(unique),
            "comments": unique
        }
