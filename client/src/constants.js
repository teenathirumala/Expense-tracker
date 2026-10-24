export const CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Health", "Entertainment", "Other"];

// One fixed colour per category so charts stay consistent
export const CATEGORY_COLORS = {
  Food: "#4f46e5",
  Transport: "#0ea5e9",
  Shopping: "#ec4899",
  Bills: "#f59e0b",
  Health: "#10b981",
  Entertainment: "#8b5cf6",
  Other: "#64748b",
};

// YYYY-MM-DD in the user's local time zone
const toISODate = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const todayISO = () => toISODate(new Date());
export const monthStartISO = () => {
  const d = new Date();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
};
export const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
};
export const yearStartISO = () => toISODate(new Date(new Date().getFullYear(), 0, 1));

export const formatINR = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// Expense dates are stored as UTC midnight, so display them in UTC to avoid off-by-one days
export const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
