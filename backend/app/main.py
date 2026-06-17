"""FastAPI application entry point for the Inventory & Order Management System."""
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError

from .config import get_settings
from .database import Base, SessionLocal, engine
from .routers import customers, dashboard, orders, products

logger = logging.getLogger("ims")
logging.basicConfig(level=logging.INFO)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- startup ---
    _wait_for_db()
    Base.metadata.create_all(bind=engine)
    if settings.seed_on_startup:
        from .seed import seed_if_empty

        with SessionLocal() as db:
            seed_if_empty(db)
            logger.info("Seed data ensured")
    yield
    # --- shutdown --- (nothing to clean up; sessions close per-request)


app = FastAPI(
    title="Inventory & Order Management System API",
    description=(
        "Backend API for managing products, customers, orders and inventory. "
        "Interactive docs are available at /docs and /redoc."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _wait_for_db(max_retries: int = 15, delay: float = 2.0) -> None:
    """Block until the database accepts connections (containers may start
    before Postgres is ready). docker-compose healthchecks also cover this,
    but this makes the backend resilient on any platform."""
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except OperationalError as exc:  # pragma: no cover - startup timing
            logger.warning("Database not ready (attempt %s/%s): %s", attempt, max_retries, exc)
            time.sleep(delay)
    raise RuntimeError("Database did not become available in time")


# Translate database integrity errors (e.g. a race that slips past the explicit
# uniqueness checks) into a clean 409 instead of a 500.
@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    logger.warning("IntegrityError on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "A record with the same unique value already exists"},
    )


@app.get("/", tags=["health"])
def root():
    return {
        "service": "Inventory & Order Management System API",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/health", tags=["health"])
def health():
    """Liveness/readiness probe used by Docker and hosting platforms."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except OperationalError:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "database": "disconnected"},
        )


app.include_router(products.router)
app.include_router(customers.router)
app.include_router(orders.router)
app.include_router(dashboard.router)
