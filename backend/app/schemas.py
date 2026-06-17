"""Pydantic request/response schemas with validation rules."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# --------------------------------------------------------------------------- #
# Products
# --------------------------------------------------------------------------- #
class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sku: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=1000)
    price: Decimal = Field(..., ge=0, decimal_places=2)
    quantity_in_stock: int = Field(..., ge=0)

    @field_validator("sku")
    @classmethod
    def strip_sku(cls, v: str) -> str:
        return v.strip()

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    """All fields optional so callers can patch individual attributes."""
    name: str | None = Field(None, min_length=1, max_length=255)
    sku: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=1000)
    price: Decimal | None = Field(None, ge=0, decimal_places=2)
    quantity_in_stock: int | None = Field(None, ge=0)


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


# --------------------------------------------------------------------------- #
# Customers
# --------------------------------------------------------------------------- #
class CustomerBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    phone: str | None = Field(None, max_length=50)


class CustomerCreate(CustomerBase):
    pass


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# --------------------------------------------------------------------------- #
# Orders
# --------------------------------------------------------------------------- #
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class OrderCreate(BaseModel):
    customer_id: int
    items: list[OrderItemCreate] = Field(..., min_length=1)


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str | None = None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    customer_name: str | None = None
    status: str
    total_amount: Decimal
    created_at: datetime
    items: list[OrderItemOut]


# --------------------------------------------------------------------------- #
# Activity log
# --------------------------------------------------------------------------- #
class OrderEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str  # "placed" | "cancelled"
    order_id: int
    customer_id: int | None = None
    customer_name: str | None = None
    total_amount: Decimal
    item_count: int
    items_summary: str | None = None
    created_at: datetime


# --------------------------------------------------------------------------- #
# Dashboard
# --------------------------------------------------------------------------- #
class LowStockProduct(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    quantity_in_stock: int


class DashboardSummary(BaseModel):
    total_products: int
    total_customers: int
    total_orders: int
    total_revenue: Decimal
    low_stock_threshold: int
    low_stock_count: int
    low_stock_products: list[LowStockProduct]


# --------------------------------------------------------------------------- #
# Generic error envelope (documented in OpenAPI)
# --------------------------------------------------------------------------- #
class ErrorResponse(BaseModel):
    detail: str
