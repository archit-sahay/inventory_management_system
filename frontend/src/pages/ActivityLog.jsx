import { useEffect, useMemo, useState } from "react";
import { ActivityAPI, extractError } from "../api/client.js";
import Spinner from "../components/Spinner.jsx";
import { useToast } from "../components/Toast.jsx";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus.js";

const money = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(v || 0)
  );

const fmtDate = (s) =>
  new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

const FILTERS = [
  { key: "all", label: "All" },
  { key: "placed", label: "Placed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function ActivityLog() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const toast = useToast();

  const load = ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    ActivityAPI.list()
      .then(setEvents)
      .catch((e) => toast.error(extractError(e)))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  const refresh = () => {
    setRefreshing(true);
    load({ silent: true });
  };

  useEffect(() => {
    load();
  }, []);

  useRefreshOnFocus(() => load({ silent: true }));

  const filtered = useMemo(
    () => (filter === "all" ? events : events.filter((e) => e.event_type === filter)),
    [events, filter]
  );

  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title">
          Activity Log{" "}
          <span className="muted" style={{ fontWeight: 400 }}>
            (read-only)
          </span>
        </div>
        <div className="page-actions">
          <div className="segmented">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`segmented__btn ${filter === f.key ? "is-active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button className="btn btn--ghost" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📜</div>
          {events.length === 0
            ? "No activity yet. Placing or cancelling an order will show up here."
            : "No activity matches this filter."}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.created_at)}</td>
                  <td>
                    <span
                      className={`badge ${
                        e.event_type === "placed" ? "badge--ok" : "badge--danger"
                      }`}
                    >
                      {e.event_type === "placed" ? "🛒 Placed" : "✖ Cancelled"}
                    </span>
                  </td>
                  <td>#{e.order_id}</td>
                  <td>{e.customer_name || `Customer ${e.customer_id ?? "—"}`}</td>
                  <td>
                    {e.items_summary || <span className="muted">—</span>}
                    {e.item_count ? (
                      <span className="muted" style={{ fontSize: "0.8rem" }}>
                        {" "}
                        ({e.item_count} unit{e.item_count === 1 ? "" : "s"})
                      </span>
                    ) : null}
                  </td>
                  <td className="text-right">{money(e.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
