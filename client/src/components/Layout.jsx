import { useEffect } from "react";
import { Outlet, useSearchParams } from "react-router-dom";
import Navbar from "./Navbar";
import ErrorBoundary from "./ErrorBoundary";
import { markPushClicked } from "../services/pushService";
import "./Layout.css";

function Layout() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const pushClickId = searchParams.get("pushClick");
    if (!pushClickId) return;

    markPushClicked(pushClickId).catch((error) => console.log(error));
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("pushClick");
        return next;
      },
      { replace: true }
    );
  }, [searchParams, setSearchParams]);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-shell__content">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default Layout;