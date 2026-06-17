import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardAPI, extractError } from "../api/client.js";
import StatCard from "../components/StatCard.jsx";
import Spinner from "../components/Spinner.jsx";
import { useToast } from "../components/Toast.jsx";

const money = (v) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(v || 0)
  );

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    DashboardAPI.summary()
      .then(setData)
      .catch((e) => toast.error(extractError(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data)
    return (
      <div className="empty-state">
        <div className="empty-state__icon">⚠️</div>
        Could not load dashboard data.
      </div>
    );

  return (
    <>
      <div className="stat-grid">
        <StatCard icon="📦" value={data.total_products} label="Total Products" />
        <StatCard
          icon="👥"
          value={data.total_customers}
          label="Total Customers"
          color="#0891b2"
          soft="#cffafe"
        />
        <StatCard
          icon="🧾"
          value={data.total_orders}
          label="Total Orders"
          color="#7c3aed"
          soft="#ede9fe"
        />
        <StatCard
          icon="💰"
          value={money(data.total_revenue)}
          label="Total Revenue"
          color="var(--success)"
          soft="var(--success-soft)"
        />
      </div>

      <div className="card">
        <div className="card__header">
          <div className="card__title">
            Low Stock Products{" "}
            <span className="muted" style={{ fontWeight: 400 }}>
              (below {data.low_stock_threshold} units)
            </span>
          </div>
          <Link to="/products" className="btn btn--ghost btn--sm">
            Manage products →
          </Link>
        </div>
        {data.low_stock_products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">✅</div>
            All products are well stocked.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>In Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.low_stock_products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.sku}</td>
                    <td>{p.quantity_in_stock}</td>
                    <td>
                      <span
                        className={`badge ${
                          p.quantity_in_stock === 0 ? "badge--danger" : "badge--warn"
                        }`}
                      >
                        {p.quantity_in_stock === 0 ? "Out of stock" : "Low stock"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
