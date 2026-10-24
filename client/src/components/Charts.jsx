import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { CATEGORY_COLORS, formatINR } from "../constants.js";

// "2026-10-23" -> "23 Oct", "2026-10" -> "Oct 2026"
function periodLabel(period, granularity) {
  const [y, m, d = 1] = period.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const opts = granularity === "day" ? { day: "numeric", month: "short" } : { month: "short", year: "numeric" };
  return date.toLocaleDateString("en-IN", { timeZone: "UTC", ...opts });
}

const tooltipFormatter = (value) => formatINR(value);

export default function Charts({ summary, trend }) {
  const pieData = summary.byCategory.map((c) => ({ name: c._id, value: c.total }));
  const barData = trend.points.map((p) => ({ label: periodLabel(p.period, trend.granularity), total: p.total }));

  return (
    <div className="card">
      <div className="row-between">
        <h2>Spending in this range</h2>
        <span className="total-sm">{formatINR(summary.grandTotal)}</span>
      </div>

      {pieData.length === 0 ? (
        <p className="muted">No expenses in this date range yet.</p>
      ) : (
        <div className="charts">
          <div className="chart">
            <h3>By category</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {pieData.map((d) => <Cell key={d.name} fill={CATEGORY_COLORS[d.name] || "#64748b"} />)}
                </Pie>
                <Tooltip formatter={tooltipFormatter} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart">
            <h3>{trend.granularity === "day" ? "Daily" : "Monthly"} spending</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} width={70} tickFormatter={(v) => "₹" + v.toLocaleString("en-IN")} />
                <Tooltip formatter={tooltipFormatter} />
                <Bar dataKey="total" name="Spent" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
