import { useEffect, useMemo, useState } from "react";
import { CustomersAPI, extractError } from "../api/client.js";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Spinner from "../components/Spinner.jsx";
import { useToast } from "../components/Toast.jsx";

const EMPTY = { full_name: "", email: "", phone: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    CustomersAPI.list()
      .then(setCustomers)
      .catch((e) => toast.error(extractError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = "Full name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid email address";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await CustomersAPI.create({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      });
      toast.success("Customer added");
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
      await CustomersAPI.remove(toDelete.id);
      toast.success("Customer deleted");
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
          <div className="card__title">Customers ({filtered.length})</div>
          <div className="page-actions">
            <input
              className="search-input"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="btn btn--primary"
              onClick={() => {
                setForm({ ...EMPTY });
                setErrors({});
              }}
            >
              + Add Customer
            </button>
          </div>
        </div>

        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👥</div>
            {customers.length === 0
              ? "No customers yet. Add your first customer."
              : "No customers match your search."}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.full_name}</strong>
                    </td>
                    <td>{c.email}</td>
                    <td>{c.phone || <span className="muted">—</span>}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => setToDelete(c)}
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
          title="Add Customer"
          onClose={() => setForm(null)}
          footer={
            <>
              <button className="btn btn--ghost" onClick={() => setForm(null)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={submit} disabled={saving}>
                {saving ? "Saving…" : "Add customer"}
              </button>
            </>
          }
        >
          <form className="form-grid" onSubmit={submit}>
            <div className={`field ${errors.full_name ? "field--error" : ""}`}>
              <label>Full name *</label>
              <input value={form.full_name} onChange={setField("full_name")} placeholder="e.g. Alice Johnson" />
              {errors.full_name && <span className="field__error">{errors.full_name}</span>}
            </div>
            <div className={`field ${errors.email ? "field--error" : ""}`}>
              <label>Email *</label>
              <input value={form.email} onChange={setField("email")} placeholder="name@example.com" />
              {errors.email ? (
                <span className="field__error">{errors.email}</span>
              ) : (
                <span className="field__hint">Must be unique across all customers.</span>
              )}
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={setField("phone")} placeholder="Optional" />
            </div>
          </form>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete customer"
          message={`Delete "${toDelete.full_name}"? Their orders will also be removed. This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
          busy={deleting}
        />
      )}
    </>
  );
}
