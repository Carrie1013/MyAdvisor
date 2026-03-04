from pathlib import Path
from pydantic_settings import BaseSettings

_BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # ── Anthropic ──────────────────────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = ""          # set via .env  (ANTHROPIC_API_KEY=sk-ant-...)
    MODEL: str = "claude-sonnet-4-6"

    # ── Paths ──────────────────────────────────────────────────────────────────
    CRITERIA_PATH: Path  = _BASE_DIR / "criteria" / "investment_rules.json"
    DOCS_DIR: Path       = _BASE_DIR / "docs"
    OUTPUT_DIR: Path     = _BASE_DIR / "output"
    PORTFOLIOS_DIR: Path = _BASE_DIR / "portfolios"
    FAISS_DIR: Path      = _BASE_DIR / ".faiss"

    # ── CORS ───────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["*"]     # tighten in production

    # ── RAG tuning ─────────────────────────────────────────────────────────────
    RAG_CHUNK_WORDS: int   = 200
    RAG_OVERLAP_WORDS: int = 30
    RAG_TOP_K: int         = 15

    model_config = {"env_file": ".env"}


settings = Settings()
