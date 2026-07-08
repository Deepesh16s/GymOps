import { useState } from "react";
import { Link } from "react-router-dom";
import "./forgotPassword.css";
import api from "../services/api";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSubmitted(true);
    } catch (error) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fp-page">
      <div className="fp-card">
        <h1 className="fp-title">Forgot Password</h1>

        {submitted ? (
          <p className="fp-message">
            If an account with that email exists, a reset link has been sent. Check your inbox.
          </p>
        ) : (
          <form className="fp-form" onSubmit={handleSubmit}>
            <label className="fp-label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              className="fp-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />

            {error && <p className="fp-error">{error}</p>}

            <button className="fp-btn" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <p className="fp-back">
          <Link to="/">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;