import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import "./UsernameSetupPrompt.css";

// One-time prompt shown when a logged-in user has a system-generated
// username they haven't explicitly confirmed yet. Rendered by Layout.jsx
// (mounts once per authenticated session) rather than login/register, so it
// also catches existing sessions revisiting the app, not just fresh logins.
function UsernameSetupPrompt({ user, onDone }) {
  const [step, setStep] = useState("intro"); // "intro" | "choose"
  const [username, setUsername] = useState(user.username || "");
  const [status, setStatus] = useState("idle"); // idle | checking | available | taken
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const checkId = useRef(0);

  useEffect(() => {
    if (step !== "choose" || !username || username === user.username) {
      setStatus("idle");
      return;
    }

    const id = ++checkId.current;
    setStatus("checking");
    const handle = setTimeout(async () => {
      try {
        const res = await api.get("/auth/username-available", { params: { username } });
        if (id !== checkId.current) return;
        setStatus(res.data.available ? "available" : "taken");
        setError(res.data.available ? "" : res.data.message || "Username is already taken");
      } catch (err) {
        if (id !== checkId.current) return;
        console.log(err);
        setStatus("idle");
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [username, step, user.username]);

  const handleMaybeLater = async () => {
    setDismissing(true);
    try {
      await api.put("/auth/username-prompt-dismissed");
    } catch (err) {
      console.log(err);
    } finally {
      onDone();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || status === "taken" || status === "checking") return;

    setSubmitting(true);
    setError("");
    try {
      await api.put("/auth/username", { username });
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || "Could not update username.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="username-prompt-backdrop" role="dialog" aria-modal="true">
      <div className="username-prompt-card">
        {step === "intro" ? (
          <>
            <h2 className="username-prompt-title">Choose your Repvyn username</h2>
            <p className="username-prompt-body">
              We've created a temporary username for your account:
              <br />
              <strong className="username-prompt-handle">@{user.username}</strong>
            </p>
            <p className="username-prompt-body">Choose a username so people can find you on Repvyn.</p>

            <button
              type="button"
              className="username-prompt-btn username-prompt-btn-primary"
              onClick={() => setStep("choose")}
            >
              Choose username
            </button>
            <button
              type="button"
              className="username-prompt-btn username-prompt-btn-ghost"
              onClick={handleMaybeLater}
              disabled={dismissing}
            >
              {dismissing ? "..." : "Maybe later"}
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 className="username-prompt-title">Pick a username</h2>
            <label className="username-prompt-label" htmlFor="username-prompt-input">
              Username
            </label>
            <input
              id="username-prompt-input"
              className="username-prompt-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              minLength={3}
              maxLength={20}
              pattern="[a-z0-9_]+"
              autoFocus
              required
            />
            {status === "checking" && <p className="username-prompt-hint">Checking availability...</p>}
            {status === "available" && (
              <p className="username-prompt-hint username-prompt-hint-success">@{username} is available</p>
            )}
            {error && <p className="username-prompt-error">{error}</p>}

            <button
              type="submit"
              className="username-prompt-btn username-prompt-btn-primary"
              disabled={submitting || status === "taken" || status === "checking"}
            >
              {submitting ? "Saving..." : "Save username"}
            </button>
            <button
              type="button"
              className="username-prompt-btn username-prompt-btn-ghost"
              onClick={() => setStep("intro")}
              disabled={submitting}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default UsernameSetupPrompt;
