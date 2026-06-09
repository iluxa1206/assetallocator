"""Portfolio computation endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.users import current_active_user
from app.db.session import get_async_session
from app.schemas.portfolio import PortfolioRequest, PortfolioResponse
from app.services.portfolio_service import compute_portfolio

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.post("/compute", response_model=PortfolioResponse)
async def compute(
    req: PortfolioRequest,
    session: AsyncSession = Depends(get_async_session),
    _user=Depends(current_active_user),
) -> PortfolioResponse:
    return await compute_portfolio(req, session)
