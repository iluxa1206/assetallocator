from fastapi import APIRouter

from app.api.v1 import admin, attachments, audit, auth, competitors, funds, invitations, portfolio, strategies, users

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(invitations.router)
api_router.include_router(admin.router)
api_router.include_router(audit.router)
api_router.include_router(attachments.router)
api_router.include_router(users.router)
api_router.include_router(portfolio.router)
api_router.include_router(funds.router)
api_router.include_router(strategies.router)
api_router.include_router(competitors.router)
