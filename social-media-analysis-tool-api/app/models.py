# app/models.py
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
import logging
from pathlib import Path

log = logging.getLogger(__name__)

class HFModels:
    def __init__(self, sentiment_dir: str, topics_dir: str, device: int = -1):
        """
        device: -1 for CPU, or torch device id for GPU.
        """
        self.device = device
        self.sentiment_dir = Path(sentiment_dir)
        self.topics_dir = Path(topics_dir)
        self.sentiment_pipe = None
        self.topics_pipe = None

    def load(self):
        # Load sentiment
        log.info(f"Loading sentiment model from {self.sentiment_dir}")
        sentiment_tokenizer = AutoTokenizer.from_pretrained(self.sentiment_dir)
        sentiment_model = AutoModelForSequenceClassification.from_pretrained(self.sentiment_dir)
        self.sentiment_pipe = pipeline(
            "text-classification",
            model=sentiment_model,
            tokenizer=sentiment_tokenizer,
            device=self.device,
            return_all_scores=False
        )

        # Load topics / categories
        log.info(f"Loading topics model from {self.topics_dir}")
        topics_tokenizer = AutoTokenizer.from_pretrained(self.topics_dir)
        topics_model = AutoModelForSequenceClassification.from_pretrained(self.topics_dir)
        self.topics_pipe = pipeline(
            "text-classification",
            model=topics_model,
            tokenizer=topics_tokenizer,
            device=self.device,
            return_all_scores=False
        )

        log.info("Models loaded successfully")
        return self

# Helper to create a global instance (you can call from main)
_global_models = None

def get_models(sentiment_dir="models/sentiment", topics_dir="models/topics", device=-1):
    global _global_models
    if _global_models is None:
        _global_models = HFModels(sentiment_dir, topics_dir, device).load()
    return _global_models
