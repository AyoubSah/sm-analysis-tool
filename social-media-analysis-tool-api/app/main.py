# app/main.py
import csv
from pathlib import Path
from fastapi import FastAPI, HTTPException
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
    allow_origins=["http://localhost:5173"],  # Your React app's URL
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
        return {"page_id": scraped.get("page_id"), "comments_analyzed": []}

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
async def analyze_csv(req: AnalyzeCsvRequest):
    # Validate file exists and is CSV
    file_path = Path(req.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=400, detail=f"File not found: {req.file_path}")
    if file_path.suffix.lower() != '.csv':
        raise HTTPException(status_code=400, detail="File must be a CSV file")

    try:
        # Read comments from CSV - expects one comment per line
        comments_meta = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for i, row in enumerate(reader, 1):
                if not row:  # Skip empty rows
                    continue
                comment_text = row[0].strip()  # Take first column as comment text
                if comment_text:  # Skip empty comments
                    comments_meta.append({
                        "comment_id": f"csv_{i}",  # Generate synthetic IDs
                        "text": comment_text
                    })
        
        if not comments_meta:
            return {"page_id":   "csv_input", "comments_analyzed": []}

        # Run analysis using existing pipeline
        try:
            merged, analytics = analyze_comments(MODELS, comments_meta, batch_size=req.batch_size)
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

