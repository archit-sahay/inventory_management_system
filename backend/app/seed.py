"""Optional demo data, inserted on startup when SEED_ON_STARTUP=true and the
products table is empty. Useful for showing off the deployed demo.
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models


def seed_if_empty(db: Session) -> None:
    has_products = db.scalar(select(func.count(models.Product.id))) or 0
    if has_products:
        return

    products = [
        models.Product(name="Wireless Mouse", sku="WM-001", price=24.99, quantity_in_stock=150, description="Ergonomic 2.4GHz wireless mouse"),
        models.Product(name="Mechanical Keyboard", sku="KB-002", price=89.99, quantity_in_stock=8, description="RGB hot-swappable mechanical keyboard"),
        models.Product(name="USB-C Hub", sku="HUB-003", price=39.50, quantity_in_stock=60, description="7-in-1 USB-C multiport adapter"),
        models.Product(name="1080p Webcam", sku="CAM-004", price=54.00, quantity_in_stock=5, description="Full HD webcam with privacy shutter"),
        models.Product(name="Laptop Stand", sku="LS-005", price=32.75, quantity_in_stock=40, description="Aluminium adjustable laptop stand"),
    ]
    db.add_all(products)

    customers = [
        models.Customer(full_name="Alice Johnson", email="alice@example.com", phone="+1-202-555-0101"),
        models.Customer(full_name="Bob Smith", email="bob@example.com", phone="+1-202-555-0144"),
        models.Customer(full_name="Carol Nguyen", email="carol@example.com", phone="+1-202-555-0188"),
    ]
    db.add_all(customers)
    db.commit()
