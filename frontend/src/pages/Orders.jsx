import { useEffect, useState } from "react";
import {
  OrdersAPI,
  ProductsAPI,
  CustomersAPI,
  extractError,
} from "../api/client.js";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Spinner from "../components/Spinner.jsx";
import { useToast } from "../components/Toast.jsx";

const money = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(v || 0)
  );

const fmtDate = (s) =>
  new Date(s).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState([{ product_id: "", quantity: 1 }]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    Promise.all([OrdersAPI.list(), ProductsAPI.list(), CustomersAPI.list()])
      .then(([o, p, c]) => {
        setOrders(o);
        setProducts(p);
        setCustomers(c);
      })
      .catch((e) => toast.error(extractError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const productById = (id) => products.find((p) => String(p.id) === String(id));

  const previewTotal = lines.reduce((sum, l) => {
    const p = productById(l.product_id);
    return sum + (p ? Number(p.price) * Number(l.quantity || 0) : 0);
  }, 0);

  const openCreate = () => {
    setCustomerId("");
    setLines([{ product_id: "", quantity: 1 }]);
    setFormError("");
    setCreating(true);
  };

  const updateLine = (idx, key, value) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));

  const addLine = () =>
    setLines((ls) => [...ls, { product_id: "", quantity: 1 }]);

  const removeLine = (idx) =>
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, i) => i !== idx)));

  const validate = () => {
    if (!customerId) return "Please select a customer.";
    const valid = lines.filter((l) => l.product_id);
    if (valid.length === 0) return "Add at least one product.";
    for (const l of valid) {
      const p = productById(l.product_id);
      const qty = Number(l.quantity);
      if (!Number.isInteger(qty) || qty <= 0)
        return `Quantity for "${p?.name}" must be a positive whole number.`;
      if (p && qty > p.quantity_in_stock)
        return `Not enough stock for "${p.name}" — only ${p.quantity_in_stock} available.`;
    }
    // detect duplicate products that together exceed stock is handled server-side;
    // client check above covers per-line for good UX.
    return "";
  };

  const submit = async (ev) => {
    ev?.preventDefault();
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    const items = lines
      .filter((l) => l.product_id)
      .map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity) }));
    setSaving(true);
    try {
      await OrdersAPI.create({ customer_id: Number(customerId), items });
      toast.success("Order created — stock updated");
      setCreating(false);
      load();
    } catch (e) {
      // Server is the source of truth (e.g. concurrent stock changes).
      setFormError(extractError(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await OrdersAPI.remove(toDelete.id);
      toast.success("Order cancelled — stock restored");
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(extractError(e));
    } finally {
      setDeleting(false);
    }
  };

  const hasProducts = products.length > 0;
  const hasCustomers = customers.length > 0;

  return (
    <>
      <div className="card">
        <div className="card__header">
          <div className="card__title">Orders ({orders.length})</div>
          <button className="btn btn--primary" onClick={openCreate}>
            + Create Order
          </button>
        </div>

        {loading ? (
          <Spinner />
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🧾</div>
            No orders yet. Create your first order.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th className="text-right">Total</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>#{o.id}</strong>
                    </td>
                    <td>{o.customer_name || `Customer ${o.customer_id}`}</td>
                    <td>
                      {o.items.reduce((n, it) => n + it.quantity, 0)} unit(s) /{" "}
                      {o.items.length} line(s)
                    </td>
                    <td className="text-right">{money(o.total_amount)}</td>
                    <td>{fmtDate(o.created_at)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => setDetail(o)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => setToDelete(o)}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create order */}
      {creating && (
        <Modal
          title="Create Order"
          size="lg"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setCreating(false)} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={submit}
                disabled={saving || !hasProducts || !hasCustomers}
              >
                {saving ? "Placing…" : `Place order · ${money(previewTotal)}`}
              </button>
            </>
          }
        >
          {!hasCustomers || !hasProducts ? (
            <div className="empty-state">
              <div className="empty-state__icon">⚠️</div>
              You need at least one customer and one product before creating an order.
            </div>
          ) : (
            <form className="form-grid" onSubmit={submit}>
              <div className="field">
                <label>Customer *</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Products *</label>
                <div className="order-items-editor">
                  {lines.map((line, idx) => {
                    const p = productById(line.product_id);
                    return (
                      <div className="order-item-row" key={idx}>
                        <select
                          value={line.product_id}
                          onChange={(e) => updateLine(idx, "product_id", e.target.value)}
                        >
                          <option value="">Select product…</option>
                          {products.map((pr) => (
                            <option
                              key={pr.id}
                              value={pr.id}
                              disabled={pr.quantity_in_stock === 0}
                            >
                              {pr.name} — {money(pr.price)} ({pr.quantity_in_stock} in stock)
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          max={p ? p.quantity_in_stock : undefined}
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => removeLine(idx)}
                          disabled={lines.length === 1}
                          aria-label="Remove line"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ marginTop: 10, alignSelf: "flex-start" }}
                  onClick={addLine}
                >
                  + Add another product
                </button>
              </div>

              <div className="order-line-total">
                <span>Estimated total</span>
                <span>{money(previewTotal)}</span>
              </div>

              {formError && <span className="field__error">{formError}</span>}
            </form>
          )}
        </Modal>
      )}

      {/* Order detail */}
      {detail && (
        <Modal title={`Order #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="detail-list" style={{ marginBottom: 18 }}>
            <div className="detail-list__row">
              <span>Customer</span>
              <span>{detail.customer_name || `Customer ${detail.customer_id}`}</span>
            </div>
            <div className="detail-list__row">
              <span>Status</span>
              <span>
                <span className="badge badge--ok">{detail.status}</span>
              </span>
            </div>
            <div className="detail-list__row">
              <span>Placed</span>
              <span>{fmtDate(detail.created_at)}</span>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Unit price</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.product_name || `Product ${it.product_id}`}</td>
                    <td className="text-right">{money(it.unit_price)}</td>
                    <td className="text-right">{it.quantity}</td>
                    <td className="text-right">{money(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="order-line-total">
            <span>Total</span>
            <span>{money(detail.total_amount)}</span>
          </div>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Cancel order"
          message={`Cancel order #${toDelete.id}? The reserved stock will be returned to inventory.`}
          confirmLabel="Cancel order"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
          busy={deleting}
        />
      )}
    </>
  );
}
