import uuid

from fastapi_users import schemas

from app.models.user import Role


class UserRead(schemas.BaseUser[uuid.UUID]):
    # Override `EmailStr` with plain `str`: admin@astra.local uses reserved `.local`
    # TLD which pydantic's email-validator rejects.
    email: str
    full_name: str
    role: Role


class UserCreate(schemas.BaseUserCreate):
    email: str
    full_name: str = ""
    role: Role = Role.SALES


class UserUpdate(schemas.BaseUserUpdate):
    email: str | None = None
    full_name: str | None = None
    role: Role | None = None

    def create_update_dict(self) -> dict:
        # Safe variant used for PATCH /users/me: users must not change their own role
        # (privilege escalation); superuser PATCH /users/{id} uses create_update_dict_superuser.
        d = super().create_update_dict()
        d.pop("role", None)
        return d
