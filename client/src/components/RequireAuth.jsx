import { Navigate } from "react-router-dom";

// Guards every route nested under it: pages here previously rendered
// unconditionally and relied on their own API calls 401-ing to redirect
// unauthenticated visitors away — which never happened for a page with
// no API calls (e.g. Guide.jsx is pure static content). This checks for
// a token before rendering anything, so a page with no data dependency
// of its own is never accessible without one.
function RequireAuth({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default RequireAuth;
