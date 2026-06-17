"""Dashboard summary endpoint."""
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import get_settings
from ..database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=schemas.DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    settings = get_settings()
    threshold = settings.low_stock_threshold

    total_products = db.scalar(select(func.count(models.Product.id))) or 0
    total_customers = db.scalar(select(func.count(models.Customer.id))) or 0
    total_orders = db.scalar(select(func.count(models.Order.id))) or 0
    total_revenue = db.scalar(select(func.coalesce(func.sum(models.Order.total_amount), 0))) or 0

    low_stock = db.scalars(
        select(models.Product)
        .where(models.Product.quantity_in_stock < threshold)
        .order_by(models.Product.quantity_in_stock.asc())
    ).all()

    return schemas.DashboardSummary(
        total_products=total_products,
        total_customers=total_customers,
        total_orders=total_orders,
        total_revenue=Decimal(total_revenue),
        low_stock_threshold=threshold,
        low_stock_count=len(low_stock),
        low_stock_products=[schemas.LowStockProduct.model_validate(p) for p in low_stock],
    )
