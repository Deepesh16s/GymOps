import { useEffect, useState } from "react";
import { Outlet, useSearchParams } from "react-router-dom";
import Navbar from "./Navbar";
import ErrorBoundary from "./ErrorBoundary";
import UsernameSetupPrompt from "./UsernameSetupPrompt";
import api from "../services/api";
import { markPushClicked } from "../services/pushService";
import * as chatSocket from "../services/chatSocket";
import "./Layout.css";

function Layout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [promptUser, setPromptUser] = useState(null);

  useEffect(() => {
    chatSocket.connect();
    return () => chatSocket.disconnect();
  }, []);

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

  useEffect(() => {
    let cancelled = false;

    api
      .get("/auth/me")
      .then((res) => {
        if (cancelled) return;
        const user = res.data;
        localStorage.setItem("user", JSON.stringify(user));
        window.dispatchEvent(new Event("repvyn:user-updated"));
        if (!user.usernameChosenByUser && !user.usernamePromptDismissedAt) {
          setPromptUser(user);
        }
      })
      .catch((error) => console.log(error));

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-shell__content">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
      {promptUser && (
        <UsernameSetupPrompt user={promptUser} onDone={() => setPromptUser(null)} />
      )}
    </div>
  );
}

export default Layout;