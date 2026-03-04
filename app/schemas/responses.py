from typing import Any, Optional
from pydantic import BaseModel


class AnalysisResponse(BaseModel):
    client_name: str
    portfolio_id: str
    report_path: str
    report_markdown: str
    rules_summary: dict
    status: str = "success"


class IndexDocsResponse(BaseModel):
    total_files: int
    indexed: int
    failed: int
    total_chunks: int


class PortfolioListItem(BaseModel):
    filename: str
    portfolio_id: str
    client_name: str
    total_value_usd: float
    valuation_date: str


class PortfolioListResponse(BaseModel):
    portfolios: list[PortfolioListItem]
    total: int


class ReportListItem(BaseModel):
    portfolio_id: str
    filename: str
    size_bytes: int
    created_at: str


class ReportListResponse(BaseModel):
    reports: list[ReportListItem]
    total: int


class DeleteResponse(BaseModel):
    deleted: bool
    detail: str


class ChatResponse(BaseModel):
    reply: str
    rag_sources: list[str] = []
    model: str


class RAGStatsResponse(BaseModel):
    total_chunks: int
    index_vectors: int
    index_path: str
    index_exists: bool
    embedding_model: str
    dim: int
