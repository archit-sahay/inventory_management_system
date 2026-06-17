import { useEffect, useMemo, useState } from "react";
import { ProductsAPI, extractError } from "../api/client.js";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Spinner from "../components/Spinner.jsx";
import { useToast } from "../components/Toast.jsx";

const money = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(v || 0)
  );

const EMPTY = { name: "", sku: "", description: "", price: "", quantity_in_stock: "" };
const LOW_STOCK = 10;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null); // null = closed; object = open
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    ProductsAPI.list()
      .then(setProducts)
      .catch((e) => toast.error(extractError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, search]);

  const openCreate = () => {
    setForm({ ...EMPTY });
    setEditingId(null);
    setErrors({});
  };

  const openEdit = (p) => {
    setForm({
      name: p.name,
      sku: p.sku,
      description: p.description || "",
      price: String(p.price),
      quantity_in_stock: String(p.quantity_in_stock),
    });
    setEditingId(p.id);
    setErrors({});
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.sku.trim()) e.sku = "SKU is required";
    if (form.price === "" || isNaN(Number(form.price)) || Number(form.price) < 0)
      e.price = "Enter a price of 0 or more";
    if (
      form.quantity_in_stock === "" ||
      !Number.isInteger(Number(form.quantity_in_stock)) ||
      Number(form.quantity_in_stock) < 0
    )
      e.quantity_in_stock = "Enter a whole number of 0 or more";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      quantity_in_stock: Number(form.quantity_in_stock),
    };
    setSaving(true);
    try {
      if (editingId) {
        await ProductsAPI.update(editingId, payload);
        toast.success("Product updated");
      } else {
        await ProductsAPI.create(payload);
        toast.success("Product created");
      }
      setForm(null);
      load();
    } catch (e) {
      toast.error(extractError(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await ProductsAPI.remove(toDelete.id);
      toast.success("Product deleted");
      setToDelete(null);
      load();
    } catch (e) {
      toast.error(extractError(e));
    } finally {
      setDeleting(false);
    }
  };

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="card">
        <div className="card__header">
          <div className="card__title">Products ({filtered.length})</div>
          <div className="page-actions">
            <input
              className="search-input"
              placeholder="Search name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn--primary" onClick={openCreate}>
              + Add Product
            </button>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📦</div>
            {products.length === 0
              ? "No products yet. Add your first product."
              : "No products match your search."}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Stock</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      {p.description && (
                        <div className="muted" style={{ fontSize: "0.8rem" }}>
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td>{p.sku}</td>
                    <td className="text-right">{money(p.price)}</td>
                    <td className="text-right">{p.quantity_in_stock}</td>
                    <td>
                      {p.quantity_in_stock === 0 ? (
                        <span className="badge badge--danger">Out of stock</span>
                      ) : p.quantity_in_stock < LOW_STOCK ? (
                        <span className="badge badge--warn">Low</span>
                      ) : (
                        <span className="badge badge--ok">In stock</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => openEdit(p)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => setToDelete(p)}
                        >
                          Delete
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

      {form && (
        <Modal
          title={editingId ? "Edit Product" : "Add Product"}
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setForm(null)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={submit} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create product"}
              </button>
            </>
          }
        >
          <form className="form-grid" onSubmit={submit}>
            <div className={`field ${errors.name ? "field--error" : ""}`}>
              <label>Product name *</label>
              <input value={form.name} onChange={setField("name")} placeholder="e.g. Wireless Mouse" />
              {errors.name && <span className="field__error">{errors.name}</span>}
            </div>
            <div className={`field ${errors.sku ? "field--error" : ""}`}>
              <label>SKU / Code *</label>
              <input value={form.sku} onChange={setField("sku")} placeholder="e.g. WM-001" />
              {errors.sku ? (
                <span className="field__error">{errors.sku}</span>
              ) : (
                <span className="field__hint">Must be unique across all products.</span>
              )}
            </div>
            <div className="form-row">
              <div className={`field ${errors.price ? "field--error" : ""}`}>
                <label>Price (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={setField("price")}
                  placeholder="0.00"
                />
                {errors.price && <span className="field__error">{errors.price}</span>}
              </div>
              <div className={`field ${errors.quantity_in_stock ? "field--error" : ""}`}>
                <label>Quantity in stock *</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={form.quantity_in_stock}
                  onChange={setField("quantity_in_stock")}
                  placeholder="0"
                />
                {errors.quantity_in_stock && (
                  <span className="field__error">{errors.quantity_in_stock}</span>
                )}
              </div>
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={setField("description")}
                placeholder="Optional notes about the product"
              />
            </div>
          </form>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete product"
          message={`Delete "${toDelete.name}" (SKU ${toDelete.sku})? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
          busy={deleting}
        />
      )}
    </>
  );
}
