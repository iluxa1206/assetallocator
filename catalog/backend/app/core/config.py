from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://astra:astra_dev@localhost:5433/astra"
    secret_key: str
    jwt_lifetime_seconds: int = 3600 * 8  # 8 hours
    cookie_secure: bool = False  # set True in prod (HTTPS)

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_tls: bool = False
    smtp_user: str = ""
    smtp_password: str = ""
    emails_from: str = "noreply@astra.local"

    app_url: str = "http://localhost:3000"


settings = Settings()
