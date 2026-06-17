"""API tests covering CRUD and the inventory business rules.

These run against an isolated temporary SQLite database so they need no
external services. The same code paths run on PostgreSQL in docker-compose and
in production.
"""
import os
import tempfile

import pytest

# Point the app at a throwaway SQLite database BEFORE importing it.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ["CORS_ORIGINS"] = "*"
os.environ["LOW_STOCK_THRESHOLD"] = "10"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_product_crud_and_unique_sku(client):
    # Create
    r = client.post("/products", json={"name": "Widget", "sku": "SKU-1", "price": 9.99, "quantity_in_stock": 100})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]

    # Duplicate SKU -> 409
    r = client.post("/products", json={"name": "Other", "sku": "SKU-1", "price": 1, "quantity_in_stock": 1})
    assert r.status_code == 409

    # Negative stock rejected by validation -> 422
    r = client.post("/products", json={"name": "Bad", "sku": "SKU-X", "price": 1, "quantity_in_stock": -5})
    assert r.status_code == 422

    # Read one
    r = client.get(f"/products/{pid}")
    assert r.status_code == 200 and r.json()["sku"] == "SKU-1"

    # Update
    r = client.put(f"/products/{pid}", json={"price": 12.50})
    assert r.status_code == 200 and float(r.json()["price"]) == 12.50

    # 404 on missing
    assert client.get("/products/999999").status_code == 404


def test_customer_unique_email(client):
    r = client.post("/customers", json={"full_name": "Jane", "email": "jane@example.com", "phone": "123"})
    assert r.status_code == 201, r.text

    # Duplicate email (case-insensitive) -> 409
    r = client.post("/customers", json={"full_name": "Jane2", "email": "JANE@example.com"})
    assert r.status_code == 409

    # Invalid email -> 422
    r = client.post("/customers", json={"full_name": "X", "email": "not-an-email"})
    assert r.status_code == 422


def test_order_reduces_stock_and_blocks_oversell(client):
    # Setup product + customer
    p = client.post("/products", json={"name": "Gadget", "sku": "G-1", "price": 5.00, "quantity_in_stock": 10}).json()
    c = client.post("/customers", json={"full_name": "Buyer", "email": "buyer@example.com"}).json()

    # Insufficient stock -> 409, stock untouched
    r = client.post("/orders", json={"customer_id": c["id"], "items": [{"product_id": p["id"], "quantity": 999}]})
    assert r.status_code == 409
    assert client.get(f"/products/{p['id']}").json()["quantity_in_stock"] == 10

    # Valid order -> 201, stock reduced, total computed by backend
    r = client.post("/orders", json={"customer_id": c["id"], "items": [{"product_id": p["id"], "quantity": 3}]})
    assert r.status_code == 201, r.text
    order = r.json()
    assert float(order["total_amount"]) == 15.00
    assert order["customer_name"] == "Buyer"
    assert client.get(f"/products/{p['id']}").json()["quantity_in_stock"] == 7

    # Cancelling the order restores stock
    assert client.delete(f"/orders/{order['id']}").status_code == 204
    assert client.get(f"/products/{p['id']}").json()["quantity_in_stock"] == 10


def test_order_unknown_customer_and_product(client):
    p = client.post("/products", json={"name": "Thing", "sku": "T-1", "price": 1, "quantity_in_stock": 5}).json()
    assert client.post("/orders", json={"customer_id": 999999, "items": [{"product_id": p["id"], "quantity": 1}]}).status_code == 404
    c = client.post("/customers", json={"full_name": "Z", "email": "z@example.com"}).json()
    assert client.post("/orders", json={"customer_id": c["id"], "items": [{"product_id": 888888, "quantity": 1}]}).status_code == 404


def test_dashboard_summary(client):
    r = client.get("/dashboard/summary")
    assert r.status_code == 200
    body = r.json()
    for key in ("total_products", "total_customers", "total_orders", "total_revenue", "low_stock_products"):
        assert key in body
    assert body["low_stock_threshold"] == 10
