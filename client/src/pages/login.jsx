import { useState, useEffect, useRef } from "react";
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
  const [googleBtnWidth, setGoogleBtnWidth] = useState(320);
  const googleWrapperRef = useRef(null);

  useEffect(() => {
    const updateWidth = () => {
      if (googleWrapperRef.current) {
        setGoogleBtnWidth(googleWrapperRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

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
        <div className="gl-grid" />
      </div>

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
            <span className="gl-badge">Workouts</span>
            <span className="gl-badge">Analytics</span>
            <span className="gl-badge">Goals</span>
          </div>
        </div>
      </div>

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

          <h1 className="gl-heading">Welcome back</h1>
          <p className="gl-sub">Sign in to continue your fitness journey</p>

          <div className="gl-socials">
            <div className="gl-social-btn google-wrapper" ref={googleWrapperRef}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                width={googleBtnWidth}
                size="large"
                shape="pill"
                theme="outline"
                text="continue_with"
                logo_alignment="center"
              />
            </div>
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
                autoComplete="email"
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
                autoComplete="current-password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="gl-error">{error}</p>}
            <button className="gl-btn" type="submit">
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