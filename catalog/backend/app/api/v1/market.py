"""Рыночные ряды — ручной запуск синка с MOEX.

Отдельный роутер, а не ветка внутри /funds: там любой новый статический сегмент
рискует столкнуться с маршрутами вида /funds/{key}/…
"""

from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.users import current_superuser
from app.db.session import get_async_session
from app.services.market_sync import sync_market_data

router = APIRouter(prefix="/market", tags=["market"])


@router.post("/sync", status_code=status.HTTP_200_OK)
async def sync(
    session: AsyncSession = Depends(get_async_session),
    _superuser=Depends(current_superuser),
) -> dict[str, Any]:
    """Дотягивает индексы и курсы до последнего закрытого месяца.

    Возвращает {колонка: сколько значений записано}. Заполняются только пустые
    ячейки — ручной ввод из xlsx не затирается. Cbonds ЗО и CPI сюда не входят:
    их источники платные/ручные.
    """
    written = await sync_market_data(session)
    return {"written": written, "total": sum(written.values())}
