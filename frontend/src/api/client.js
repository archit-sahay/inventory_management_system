import axios from "axios";

// Base URL is injected at build time via Vite env vars. Falls back to the
// local backend for `npm run dev`.
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Normalize backend/network errors into a single human-readable message.
export function extractError(error) {
  if (error.response) {
    const data = error.response.data;
    if (data?.detail) {
      // FastAPI validation errors come back as an array of objects.
      if (Array.isArray(data.detail)) {
        return data.detail
          .map((d) => {
            const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
            return field ? `${field}: ${d.msg}` : d.msg;
          })
          .join("; ");
      }
      return data.detail;
    }
    return `Request failed with status ${error.response.status}`;
  }
  if (error.request) {
    return "Cannot reach the server. Check that the backend is running.";
  }
  return error.message || "Unexpected error";
}

// ---- Products ------------------------------------------------------------ //
export const ProductsAPI = {
  list: () => api.get("/products").then((r) => r.data),
  get: (id) => api.get(`/products/${id}`).then((r) => r.data),
  create: (payload) => api.post("/products", payload).then((r) => r.data),
  update: (id, payload) => api.put(`/products/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/products/${id}`),
};

// ---- Customers ----------------------------------------------------------- //
export const CustomersAPI = {
  list: () => api.get("/customers").then((r) => r.data),
  get: (id) => api.get(`/customers/${id}`).then((r) => r.data),
  create: (payload) => api.post("/customers", payload).then((r) => r.data),
  remove: (id) => api.delete(`/customers/${id}`),
};

// ---- Orders -------------------------------------------------------------- //
export const OrdersAPI = {
  list: () => api.get("/orders").then((r) => r.data),
  get: (id) => api.get(`/orders/${id}`).then((r) => r.data),
  create: (payload) => api.post("/orders", payload).then((r) => r.data),
  remove: (id) => api.delete(`/orders/${id}`),
};

// ---- Activity log -------------------------------------------------------- //
export const ActivityAPI = {
  list: () => api.get("/activity").then((r) => r.data),
};

// ---- Dashboard ----------------------------------------------------------- //
export const DashboardAPI = {
  summary: () => api.get("/dashboard/summary").then((r) => r.data),
};

export default api;
