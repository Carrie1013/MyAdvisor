from typing import Any, Optional
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    portfolio_file: str = Field(..., description="Path to portfolio JSON, relative to project root")
    client_name: str = Field(..., description="Display name for the client")
    language: str = Field("English", description="Report language")


class PortfolioData(BaseModel):
    portfolio_id: str
    client_name: str = ""
    total_value_usd: float
    valuation_date: str = ""
    holdings: list[dict[str, Any]] = []
    asset_allocation: dict[str, float] = {}
    sector_breakdown: dict[str, float] = {}
    geographic_breakdown: dict[str, float] = {}
    client_profile: dict[str, Any] = {}


class PortfolioUploadRequest(BaseModel):
    """Submit portfolio data inline (no file required)."""
    client_name: str
    portfolio: dict[str, Any] = Field(..., description="Full portfolio JSON object")
    language: str = "English"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[dict[str, str]] = Field(
        default_factory=list,
        description="Prior turns: [{role: 'user'|'assistant', content: '...'}]",
    )
    portfolio_id: Optional[str] = Field(
        None,
        description="If provided, inject portfolio context and relevant RAG chunks",
    )
    n_rag_chunks: int = Field(8, ge=0, le=30, description="RAG chunks to inject")
