export default function StatCard({ icon, value, label, color = "var(--primary)", soft = "var(--primary-soft)" }) {
  return (
    <div className="stat-card">
      <div className="stat-card__icon" style={{ background: soft, color }}>
        {icon}
      </div>
      <div>
        <div className="stat-card__value">{value}</div>
        <div className="stat-card__label">{label}</div>
      </div>
    </div>
  );
}
