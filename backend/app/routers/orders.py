"""Order endpoints with inventory business rules.

Business rules implemented here:
  * An order references an existing customer and one or more existing products.
  * Orders cannot be placed when stock is insufficient (HTTP 409).
  * Placing an order atomically reduces product stock.
  * The total amount is computed by the backend (never trusted from the client).
  * Cancelling/deleting an order restores the reserved stock.
"""
from collections import defaultdict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/orders", tags=["orders"])


def _serialize_order(order: models.Order) -> schemas.OrderOut:
    return schemas.OrderOut(
        id=order.id,
        customer_id=order.customer_id,
        customer_name=order.customer.full_name if order.customer else None,
        status=order.status,
        total_amount=order.total_amount,
        created_at=order.created_at,
        items=[
            schemas.OrderItemOut(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else None,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
            )
            for item in order.items
        ],
    )


def _load_order_or_404(db: Session, order_id: int) -> models.Order:
    order = db.scalar(
        select(models.Order)
        .where(models.Order.id == order_id)
        .options(
            selectinload(models.Order.items).selectinload(models.OrderItem.product),
            selectinload(models.Order.customer),
        )
    )
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        )
    return order


@router.post(
    "",
    response_model=schemas.OrderOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {"model": schemas.ErrorResponse},
        404: {"model": schemas.ErrorResponse},
        409: {"model": schemas.ErrorResponse},
    },
)
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    # 1. Customer must exist.
    customer = db.get(models.Customer, payload.customer_id)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {payload.customer_id} not found",
        )

    # 2. Merge duplicate product lines so quantities are summed once.
    requested: dict[int, int] = defaultdict(int)
    for line in payload.items:
        requested[line.product_id] += line.quantity

    # 3. Lock product rows and validate existence + stock.
    products: dict[int, models.Product] = {}
    for product_id, qty in requested.items():
        product = db.scalar(
            select(models.Product)
            .where(models.Product.id == product_id)
            .with_for_update()
        )
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {product_id} not found",
            )
        if product.quantity_in_stock < qty:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Insufficient stock for '{product.name}' (SKU {product.sku}): "
                    f"requested {qty}, available {product.quantity_in_stock}"
                ),
            )
        products[product_id] = product

    # 4. Create the order, compute totals, and reduce stock atomically.
    order = models.Order(customer_id=customer.id, status="confirmed", total_amount=0)
    db.add(order)

    total = Decimal("0.00")
    for product_id, qty in requested.items():
        product = products[product_id]
        unit_price = Decimal(product.price)
        subtotal = unit_price * qty
        total += subtotal
        product.quantity_in_stock -= qty
        order.items.append(
            models.OrderItem(
                product_id=product.id,
                quantity=qty,
                unit_price=unit_price,
                subtotal=subtotal,
            )
        )

    order.total_amount = total
    db.commit()

    return _serialize_order(_load_order_or_404(db, order.id))


@router.get("", response_model=list[schemas.OrderOut])
def list_orders(db: Session = Depends(get_db)):
    orders = db.scalars(
        select(models.Order)
        .order_by(models.Order.id.desc())
        .options(
            selectinload(models.Order.items).selectinload(models.OrderItem.product),
            selectinload(models.Order.customer),
        )
    ).all()
    return [_serialize_order(o) for o in orders]


@router.get(
    "/{order_id}",
    response_model=schemas.OrderOut,
    responses={404: {"model": schemas.ErrorResponse}},
)
def get_order(order_id: int, db: Session = Depends(get_db)):
    return _serialize_order(_load_order_or_404(db, order_id))


@router.delete(
    "/{order_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": schemas.ErrorResponse}},
)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    """Cancel/delete an order and restore the stock it had reserved."""
    order = _load_order_or_404(db, order_id)
    for item in order.items:
        product = db.get(models.Product, item.product_id)
        if product is not None:
            product.quantity_in_stock += item.quantity
    db.delete(order)
    db.commit()
    return None
