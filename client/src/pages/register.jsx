import "../styles/auth.css";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import api from "../services/api";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const { name, email, password, confirmPassword } = formData;

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError("");

    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/auth/register", { name, email, password });

      navigate("/login");
    } catch (error) {
      console.log(error);

      setFormError(error.response?.data?.message || "Registration failed. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-atmosphere">
        <div className="auth-glow auth-glow--1" />
        <div className="auth-glow auth-glow--2" />
      </div>

      <header className="auth-topbar">
        <Link to="/" className="auth-brand">
          <BrandMark size={22} />
          <span>Rep<span className="auth-brand-accent">vyn</span></span>
        </Link>
      </header>

      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-heading">Create your account</h1>
          <p className="auth-sub">Start logging your training today.</p>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="register-name">
                Full name
              </label>
              <input
                className="auth-input"
                id="register-name"
                type="text"
                name="name"
                autoComplete="name"
                placeholder="Enter your full name"
                value={name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="register-email">
                Email address
              </label>
              <input
                className="auth-input"
                id="register-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="register-password">
                Password
              </label>
              <input
                className="auth-input"
                id="register-password"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="Create a password"
                value={password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="register-confirm-password">
                Confirm password
              </label>
              <input
                className="auth-input"
                id="register-confirm-password"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            {formError && <p className="auth-error">{formError}</p>}

            <button type="submit" className="auth-btn" disabled={isSubmitting}>
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{" "}
            <Link to="/login" className="auth-switch-link">
              Login
            </Link>
          </p>
        </div>
      </main>

      <p className="auth-footnote">Track Workouts &bull; Build Strength &bull; Visualize Progress</p>
    </div>
  );
}

export default Register;
