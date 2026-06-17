"""Customer endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/customers", tags=["customers"])


def _get_customer_or_404(db: Session, customer_id: int) -> models.Customer:
    customer = db.get(models.Customer, customer_id)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} not found",
        )
    return customer


@router.post(
    "",
    response_model=schemas.CustomerOut,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": schemas.ErrorResponse}},
)
def create_customer(payload: schemas.CustomerCreate, db: Session = Depends(get_db)):
    """Create a customer. Email must be unique."""
    email = str(payload.email).lower()
    exists = db.scalar(select(models.Customer).where(models.Customer.email == email))
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A customer with email '{email}' already exists",
        )
    customer = models.Customer(
        full_name=payload.full_name, email=email, phone=payload.phone
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("", response_model=list[schemas.CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.scalars(select(models.Customer).order_by(models.Customer.id)).all()


@router.get(
    "/{customer_id}",
    response_model=schemas.CustomerOut,
    responses={404: {"model": schemas.ErrorResponse}},
)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    return _get_customer_or_404(db, customer_id)


@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"model": schemas.ErrorResponse}},
)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = _get_customer_or_404(db, customer_id)
    db.delete(customer)
    db.commit()
    return None
