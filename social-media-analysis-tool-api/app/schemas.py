# app/schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List

class ScrapeRequest(BaseModel):
    graph_api_key: str = Field(..., min_length=10)
    page: str = Field(..., description="page id / username / full url")
    max_posts: int = Field(10, gt=0, le=500)
    max_comments: int = Field(500, gt=0, le=50000)
    since: Optional[str] = None  # ISO date optional
    until: Optional[str] = None

class CommentOut(BaseModel):
    comment_id: str
    post_id: str
    text: str
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    created_time: Optional[str] = None

class ScrapeResponse(BaseModel):
    page_id: str
    posts_scanned: int
    total_fetched: int
    comments: List[CommentOut]

class CommentResult(BaseModel):
    comment_id: str
    text: str
    sentiment: Optional[str]
    sentiment_conf: Optional[float]
    category: Optional[str]
    category_conf: Optional[float]
    created_time: Optional[str]

class CategoryStats(BaseModel):
    category: str
    total_comments: int
    positive_comments: int
    negative_comments: int
    neutral_comments: int

class CommentsAnalytics(BaseModel):
    total_comments: int
    positive_comments: int
    negative_comments: int
    neutral_comments: int
    categories_stats: List[CategoryStats]

class AnalyzeResponse(BaseModel):
    page_id: str
    comments_analyzed: List[CommentResult]
    analytics: CommentsAnalytics

class AnalyzeCsvRequest(BaseModel):
    file_path: str = Field(..., description="Path to CSV file containing comments")
    batch_size: int = Field(32, gt=0, le=128, description="Batch size for model inference")
