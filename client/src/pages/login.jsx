import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Link, useNavigate } from "react-router-dom";
import hero from "../assets/hero.jpg";
import "./login.css";
import api from "../services/api";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await api.post("/auth/google", {
        token: credentialResponse.credential,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      navigate("/dashboard");
    } catch (error) {
      console.log(error);
      setError("Google Login Failed");
    }
  };

  const handleGoogleError = () => {
    setError("Google Login Failed");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(formData.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!formData.password.trim()) {
      setError("Password is required.");
      return;
    }

    try {
      const response = await api.post("/auth/login", {
        email: formData.email.trim(),
        password: formData.password,
      });

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      setError("");
      navigate("/dashboard");
    } catch (error) {
      console.log(error);
      setError(error.response?.data?.message || "Login Failed");
    }
  };

  return (
    <div className="gl-root">
      <div className="gl-bg">
        <div className="gl-orb gl-orb-1" />
        <div className="gl-orb gl-orb-2" />
        <div className="gl-orb gl-orb-3" />
        <div className="gl-grid" />
        <div className="gl-particle" style={{ left: "8%", animationDelay: "0s", animationDuration: "5s" }} />
        <div className="gl-particle" style={{ left: "20%", animationDelay: "1.2s", animationDuration: "7s" }} />
        <div className="gl-particle" style={{ left: "35%", animationDelay: "0.5s", animationDuration: "6s" }} />
        <div className="gl-particle" style={{ left: "55%", animationDelay: "2s", animationDuration: "8s" }} />
        <div className="gl-particle" style={{ left: "72%", animationDelay: "0.8s", animationDuration: "5.5s" }} />
        <div className="gl-particle" style={{ left: "88%", animationDelay: "1.8s", animationDuration: "7.5s" }} />
      </div>

      {/* LEFT: Hero Panel */}
      <div className="gl-hero">
        <img src={hero} alt="Gym" className="gl-hero-img" />
        <div className="gl-hero-overlay" />
        <div className="gl-hero-content">
          <div className="gl-logo">
            <div className="gl-logo-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 14l3-4 3 3 3-5 3 6"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="gl-logo-text">
              Gym<span className="gl-logo-dot">Ops</span>
            </span>
          </div>
          <p className="gl-tagline">
            Track Workouts&nbsp;•&nbsp;Build Strength&nbsp;•&nbsp;Visualize Progress
          </p>
          <div className="gl-badges">
            <span className="gl-badge">🏋️ Workouts</span>
            <span className="gl-badge">📈 Analytics</span>
            <span className="gl-badge">🥗 Nutrition</span>
          </div>
        </div>
      </div>

      {/* RIGHT: Auth Panel */}
      <div className="gl-panel">
        <div className="gl-card">
          <div className="gl-card-glow" />

          <div className="gl-card-logo">
            <div className="gl-card-logo-icon">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 14l3-4 3 3 3-5 3 6"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="gl-card-logo-text">
              Gym<span className="gl-card-logo-dot">Ops</span>
            </span>
          </div>

          <h1 className="gl-heading">Welcome back 👋</h1>
          <p className="gl-sub">Sign in to continue your fitness journey</p>

          <div className="gl-socials">
            <div className="gl-social-btn google-wrapper">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
              />
            </div>

            <button className="gl-social-btn" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0f172a">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Apple
            </button>
          </div>

          <div className="gl-divider">
            <div className="gl-divider-line" />
            <span className="gl-divider-text">or sign in with email</span>
            <div className="gl-divider-line" />
          </div>

          <form className="gl-form" onSubmit={handleSubmit} noValidate>
            <div className="gl-field">
              <label className="gl-label" htmlFor="email">
                Email address
              </label>
              <input
                className="gl-input"
                id="email"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            <div className="gl-field">
              <div className="gl-label-row">
                <label className="gl-label" htmlFor="password">
                  Password
                </label>
                <Link to="/forgot-password" className="gl-forgot">
                  Forgot password?
                </Link>
              </div>
              <input
                className="gl-input"
                id="password"
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="gl-error">{error}</p>}
            <button className="gl-btn" type="submit">
              <span className="gl-btn-shimmer" />
              Sign In
            </button>
          </form>

          <p className="gl-register">
            Don't have an account?{" "}
            <Link to="/register" className="gl-register-link">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}