const BASE = (import.meta.env.VITE_API_URL || "") + "/api";

const authHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function toError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  const err = new Error(data.message || fallback);
  err.status = res.status;
  return err;
}

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await toError(res, "Request failed");
  return res.json();
}

// Downloads a file (e.g. the CSV export) from an authenticated endpoint
export async function download(path, filename) {
  const res = await fetch(BASE + path, { headers: authHeader() });
  if (!res.ok) throw await toError(res, "Download failed");

  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
