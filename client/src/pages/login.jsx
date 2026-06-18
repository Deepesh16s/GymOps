import { useState } from "react";
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    const response = await api.post(
      "/auth/login",
      formData
    );

    localStorage.setItem(
      "token",
      response.data.token
    );

    localStorage.setItem(
      "user",
      JSON.stringify(response.data.user)
    );

    alert("Login Successful!");

    navigate("/dashboard");
  } catch (error) {
  console.log(error);
  console.log(error.response);
  console.log(error.response?.data);

  alert(
    error.response?.data?.message ||
    "Login Failed"
  );
}
};
  return (
    <div className="gl-root">
      {/* Ambient background effects */}
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

          {/* Card Logo */}
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

          {/* Social Buttons */}
          <div className="gl-socials">
            <button className="gl-social-btn" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
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
                <a href="#" className="gl-forgot">
                  Forgot password?
                </a>
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