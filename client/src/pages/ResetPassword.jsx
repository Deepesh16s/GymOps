import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import "./resetPassword.css";
import api from "../services/api";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);

    try {
      await api.post(`/auth/reset-password/${token}`, { newPassword });
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (error) {
      setError(error.response?.data?.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rp-page">
      <div className="rp-card">
        <h1 className="rp-title">Reset Password</h1>

        {success ? (
          <p className="rp-message">Password reset successfully. Redirecting to login...</p>
        ) : (
          <form className="rp-form" onSubmit={handleSubmit}>
            <label className="rp-label" htmlFor="newPassword">
              New Password
            </label>
            <input
              id="newPassword"
              className="rp-input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <label className="rp-label" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              className="rp-input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            {error && <p className="rp-error">{error}</p>}

            <button className="rp-btn" type="submit" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}

        <p className="rp-back">
          <Link to="/">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;