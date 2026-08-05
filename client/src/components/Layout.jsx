import { useEffect } from "react";
import { Outlet, useSearchParams } from "react-router-dom";
import Navbar from "./Navbar";
import { markPushClicked } from "../services/pushService";
import "./Layout.css";

function Layout() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Phase 13D, Part B (section 11) — the service worker's
  // notificationclick handler navigates here with ?pushClick=<id> rather
  // than calling the API itself (a service worker has no access to the
  // app's auth token) — this is the one place, common to every
  // authenticated page, that finishes that hand-off using the app's own
  // already-authenticated axios instance, then strips the param so a
  // refresh doesn't re-fire it.
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
        <Outlet />
      </div>
    </div>
  );
}

export default Layout;