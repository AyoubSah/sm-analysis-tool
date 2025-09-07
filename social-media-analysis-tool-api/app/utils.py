# app/utils.py
from typing import List, Dict, Any
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from itertools import chain
import numpy
import torch

def chunk_list(items: List, chunk_size: int):
    for i in range(0, len(items), chunk_size):
        yield items[i:i+chunk_size]

def _predict_batch(pipeline, texts):
    """
    wrapper so we can call both pipelines similarly.
    pipeline is HF text-classification pipeline and returns:
    e.g. {'label': 'POS', 'score': 0.98}
    or a list (if multiclass with return_all_scores); we assume single label per input.
    """
    return pipeline(texts, truncation=True)

def merge_model_outputs(comments_meta: List[Dict], sentiment_preds: List, topics_preds: List):
    """
    comments_meta: list of dicts in original order, each has at least keys: comment_id, text
    sentiment_preds: list (same order) of { 'label':..., 'score':... }
    topics_preds: same as above
    returns merged list with fields:
        comment_id, text, sentiment, sentiment_conf, category, category_conf
    """
    merged = []
    for meta, s, t in zip(comments_meta, sentiment_preds, topics_preds):
        # Normalize different pipeline return shapes if necessary
        if isinstance(s, list):
            # sometimes pipeline returns list of lists
            s_item = s[0] if len(s)==1 else s
        else:
            s_item = s
        if isinstance(t, list):
            t_item = t[0] if len(t)==1 else t
        else:
            t_item = t

        sentiment_label = s_item.get("label") if isinstance(s_item, dict) else None
        sentiment_score = float(s_item.get("score", 0.0)) if isinstance(s_item, dict) else None

        topic_label = t_item.get("label") if isinstance(t_item, dict) else None
        topic_score = float(t_item.get("score", 0.0)) if isinstance(t_item, dict) else None

        merged.append({
            "comment_id": meta.get("comment_id"),
            "text": meta.get("text"),
            "sentiment": sentiment_label,
            "sentiment_conf": sentiment_score,
            "category": topic_label,
            "category_conf": topic_score,
            "created_time": meta.get("created_time")
        })
    return merged

def generate_analytics(merged_comments):
    """
    Generate analytics from merged comments including sentiment and category statistics.
    
    Args:
        merged_comments: List of dicts with 'sentiment' and 'category' fields
    
    Returns:
        Dict with total counts and per-category statistics
    """
    analytics = {
        "total_comments": len(merged_comments),
        "positive_comments": 0,
        "negative_comments": 0,
        "neutral_comments": 0,
        "categories_stats": {}
    }
    
    # Initialize category stats
    categories = {c["category"] for c in merged_comments if c["category"]}
    for cat in categories:
        analytics["categories_stats"][cat] = {
            "category": cat,
            "total_comments": 0,
            "positive_comments": 0,
            "negative_comments": 0,
            "neutral_comments": 0
        }
    
    # Count statistics
    for comment in merged_comments:
        sentiment = comment.get("sentiment", "").lower()
        category = comment.get("category")
        
        # Update global sentiment counts
        if sentiment == "positive":
            analytics["positive_comments"] += 1
        elif sentiment == "negative":
            analytics["negative_comments"] += 1
        else:
            analytics["neutral_comments"] += 1
            
        # Update per-category counts
        if category:
            cat_stats = analytics["categories_stats"][category]
            cat_stats["total_comments"] += 1
            if sentiment == "positive":
                cat_stats["positive_comments"] += 1
            elif sentiment == "negative":
                cat_stats["negative_comments"] += 1
            else:
                cat_stats["neutral_comments"] += 1
    
    # Convert categories_stats from dict to list for better API response
    analytics["categories_stats"] = list(analytics["categories_stats"].values())
    return analytics

def analyze_comments(models, comments_meta, batch_size=32):
    """
    comments_meta: ordered list of dicts each has 'comment_id' and 'text'
    models: instance from models.get_models()
    returns merged predictions (list) and analytics
    """
    texts = [c["text"] for c in comments_meta]
    # We'll collect predictions in the original order
    sentiment_results = []
    topic_results = []

    # Execute batches; for each batch run both pipelines in parallel via ThreadPoolExecutor
    for batch_texts in chunk_list(texts, batch_size):
        with ThreadPoolExecutor(max_workers=2) as ex:
            print('Analyzing batch of size:', len(batch_texts))
            fut_s = ex.submit(_predict_batch, models.sentiment_pipe, batch_texts)
            fut_t = ex.submit(_predict_batch, models.topics_pipe, batch_texts)
            print('Waiting for model predictions...')
            s_out = fut_s.result()
            t_out = fut_t.result()
            print('Batch analysis done.')

        # pipeline returns a list of dicts corresponding to batch_texts (or single dict for single input)
        # normalize to list form
        if isinstance(s_out, dict):
            s_out = [s_out]
        if isinstance(t_out, dict):
            t_out = [t_out]
        sentiment_results.extend(s_out)
        topic_results.extend(t_out)

    # merge (works because we processed in-order batches)
    merged = merge_model_outputs(comments_meta, sentiment_results, topic_results)
    
    # Generate analytics from merged results
    analytics = generate_analytics(merged)
    
    return merged, analytics
