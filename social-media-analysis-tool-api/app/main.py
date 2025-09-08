# app/main.py
import csv
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import ScrapeRequest, AnalyzeResponse, CommentResult, AnalyzeCsvRequest
from app.fb_scraper import fetch_all_comments
from app.models import get_models
from app.utils import analyze_comments
import logging

log = logging.getLogger("uvicorn.error")

app = FastAPI(title="AI Webapp - Scraper + Analyzer")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:5174"],  # Your React app's URL
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# load models once at startup
MODELS = None

@app.on_event("startup")
async def startup_event():
    global MODELS
    MODELS = get_models(
        sentiment_dir="models/sentiment",
        topics_dir="models/topics",
        device=-1  # -1 means CPU
    )
    log.info("Models loaded and ready")

@app.get("/health")
async def health():
    return {"ok": True}

@app.post("/scrape-analyze", response_model=AnalyzeResponse)
async def scrape_analyze(req: ScrapeRequest):
    try:
        # 1) fetch comments
        scraped = await fetch_all_comments(
            page=req.page,
            access_token=req.graph_api_key,
            max_posts=req.max_posts,
            max_comments=req.max_comments,
            since=req.since,
            until=req.until,
            concurrency=3,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraper error: {e}")

    comments = scraped.get("comments", [])
    if not comments:
        # Ensure response_model contract with empty analytics
        return {
            "page_id": scraped.get("page_id"),
            "comments_analyzed": [],
            "analytics": {
                "total_comments": 0,
                "positive_comments": 0,
                "negative_comments": 0,
                "neutral_comments": 0,
                "categories_stats": [],
            },
        }

    # 2) build comments_meta (list of dicts with id + text + created_time)
    comments_meta = [{"comment_id": c.get("comment_id"), "text": c.get("text", ""), "created_time": c.get("created_time")} for c in comments]

    # 3) run analysis
    try:
        merged, analytics = analyze_comments(MODELS, comments_meta, batch_size=32)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model inference error: {e}")

    # 4) format response
    results = [CommentResult(**m) for m in merged]
    return {
        "page_id": scraped.get("page_id"), 
        "comments_analyzed": results,
        "analytics": analytics
    }

@app.post("/analyze-csv", response_model=AnalyzeResponse)
async def analyze_csv(
    file: UploadFile = File(...),
    batch_size: int = Form(32),
):
    """Accept a CSV file upload and analyze its comments.
    
    This endpoint accepts form data with a CSV file and optional batch_size parameter.
    """

    try:
        content_bytes = await file.read()
        text = content_bytes.decode("utf-8", errors="ignore")

        # Use csv module to read; detect header by checking the first line
        comments_meta = []
        reader = csv.reader(text.splitlines())
        rows = list(reader)
        if not rows:
            raise HTTPException(status_code=400, detail="CSV file is empty")
        
        # Check if CSV has headers (comment_id, text, created_time)
        header = [col.strip().lower() for col in rows[0]]
        has_header = "comment_id" in header and "text" in header
        
        if has_header:
            # Get column indices
            comment_id_idx = header.index("comment_id")
            text_idx = header.index("text")
            created_time_idx = header.index("created_time") if "created_time" in header else -1
            
            # Process rows with headers
            for row in rows[1:]:  # Skip header row
                if not row:  # Skip empty rows
                    continue
                
                if len(row) <= text_idx:  # Skip rows that don't have enough columns
                    continue
                    
                comment_text = row[text_idx].strip()
                if not comment_text:  # Skip empty comments
                    continue
                    
                comment_data = {
                    "comment_id": row[comment_id_idx].strip() if len(row) > comment_id_idx else f"csv_{len(comments_meta)+1}",
                    "text": comment_text
                }
                
                # Add created_time if available
                if created_time_idx >= 0 and len(row) > created_time_idx:
                    created_time = row[created_time_idx].strip()
                    if created_time:
                        comment_data["created_time"] = created_time
                        
                comments_meta.append(comment_data)
        else:
            # Fallback to assuming first column is text (old behavior)
            for i, row in enumerate(rows, 1):
                if not row:  # Skip empty rows
                    continue
                comment_text = row[0].strip()  # Take first column as comment text
                if comment_text:  # Skip empty comments
                    comments_meta.append({
                        "comment_id": f"csv_{i}",  # Generate synthetic IDs
                        "text": comment_text
                    })
        if not comments_meta:
            return {
                "page_id": "csv_input",
                "comments_analyzed": [],
                "analytics": {
                    "total_comments": 0,
                    "positive_comments": 0,
                    "negative_comments": 0,
                    "neutral_comments": 0,
                    "categories_stats": [],
                },
            }

        # Run analysis using existing pipeline
        try:
            merged, analytics = analyze_comments(MODELS, comments_meta, batch_size=batch_size)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Model inference error: {e}")

        # Format response
        results = [CommentResult(**m) for m in merged]
        return {
            "page_id": "csv_input", 
            "comments_analyzed": results,
            "analytics": analytics
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing CSV: {str(e)}")


@app.post("/analyze-csv-upload", response_model=AnalyzeResponse)
async def analyze_csv_upload(
    file: UploadFile = File(...),
    batch_size: int = Form(32),
):
    """Accept a CSV file upload and analyze its comments.

    Supported CSV formats:
    - With header (preferred): columns "id", "comment"; optional "created_time" (ISO or parseable string)
    - Without header: first column treated as the comment text
    """
    try:
        content_bytes = await file.read()
        text = content_bytes.decode("utf-8", errors="ignore")

        # Use csv module to read; detect header by checking the first line
        comments_meta = []
        reader = csv.reader(text.splitlines())
        rows = list(reader)
        if not rows:
            return {
                "page_id": "csv_input",
                "comments_analyzed": [],
                "analytics": {
                    "total_comments": 0,
                    "positive_comments": 0,
                    "negative_comments": 0,
                    "neutral_comments": 0,
                    "categories_stats": [],
                },
            }

        header = [c.strip().lower() for c in rows[0]] if rows else []
        has_header = "comment" in header or "id" in header

        if has_header:
            col_idx = {name: header.index(name) for name in header}
            for i, row in enumerate(rows[1:], start=1):
                if not row:
                    continue
                try:
                    comment_text = row[col_idx.get("comment", 0)].strip()
                except Exception:
                    comment_text = (row[0] or "").strip()
                if not comment_text:
                    continue
                # Prefer provided id if present; otherwise synthesize
                comment_id = (
                    str(row[col_idx["id"]]).strip() if "id" in col_idx and col_idx["id"] < len(row) and str(row[col_idx["id"]]).strip() else f"csv_{i}"
                )
                created_time = None
                if "created_time" in col_idx and col_idx["created_time"] < len(row):
                    created_time_val = str(row[col_idx["created_time"]]).strip()
                    created_time = created_time_val or None
                comments_meta.append({
                    "comment_id": comment_id,
                    "text": comment_text,
                    "created_time": created_time,
                })
        else:
            # No header: first column is comment text
            for i, row in enumerate(rows, start=1):
                if not row:
                    continue
                comment_text = (row[0] or "").strip()
                if comment_text:
                    comments_meta.append({
                        "comment_id": f"csv_{i}",
                        "text": comment_text,
                    })

        if not comments_meta:
            return {
                "page_id": "csv_input",
                "comments_analyzed": [],
                "analytics": {
                    "total_comments": 0,
                    "positive_comments": 0,
                    "negative_comments": 0,
                    "neutral_comments": 0,
                    "categories_stats": [],
                },
            }

        try:
            merged, analytics = analyze_comments(MODELS, comments_meta, batch_size=batch_size)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Model inference error: {e}")

        results = [CommentResult(**m) for m in merged]
        return {
            "page_id": "csv_input",
            "comments_analyzed": results,
            "analytics": analytics,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing upload: {str(e)}")

