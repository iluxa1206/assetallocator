from fastapi import APIRouter

from app.core.users import auth_backend, bearer_backend, fastapi_users

router = APIRouter(prefix="/auth", tags=["auth"])

# Cookie backend — POST /auth/login → 204 + Set-Cookie (HttpOnly)
router.include_router(fastapi_users.get_auth_router(auth_backend))
# Bearer backend — POST /auth/jwt/login → 200 {access_token, token_type}
# Frontend uses this so it can set its own cookie + localStorage and survive proxy quirks.
router.include_router(fastapi_users.get_auth_router(bearer_backend), prefix="/jwt")
# No public register/reset/verify routers: accounts are created via admin invitations
# (see api/v1/invitations.py), password resets go through admin-issued links.
