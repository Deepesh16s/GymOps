import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

/* Attach the token automatically on every request. Existing pages
   that still build their own { headers: { Authorization } } config
   keep working fine — this just means new pages don't have to. */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* If the token is expired/invalid, the server responds 401 — clear
   it and bounce back to login instead of leaving the user stuck on
   a page where every request silently fails. */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default api;