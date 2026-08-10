import "./register.css";
import hero from "../assets/hero.jpg";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const {
    name,
    email,
    password,
    confirmPassword,
  } = formData;

  const [formError, setFormError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]:
        e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (
      password !== confirmPassword
    ) {
      setFormError("Passwords do not match");
      return;
    }

    try {
      await api.post(
        "/auth/register",
        {
          name,
          email,
          password,
        }
      );

      navigate("/");
    } catch (error) {
      console.log(error);

      setFormError(
        error.response?.data
          ?.message ||
          "Registration failed. Please try again."
      );
    }
  };

  return (
    <div className="register-container">
      <div className="register-left">
        <img
          src={hero}
          alt="GymOps"
        />

        <div className="hero-overlay"></div>

        <div className="hero-content">
          <div className="hero-logo">
            <div className="logo-icon">
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 14l3-4 3 3 3-5 3 6"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h1>GymOps</h1>
          </div>

          <p>
            Track Workouts • Build
            Strength • Visualize
            Progress
          </p>

          <div className="hero-tags">
            <span>
              Workouts
            </span>

            <span>
              Analytics
            </span>

            <span>
              Goals
            </span>
          </div>
        </div>
      </div>

      <div className="register-right">
        <div className="register-card">
          <div className="card-logo">
            <div className="logo-icon">
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 14l3-4 3 3 3-5 3 6"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h3>GymOps</h3>
          </div>

          <h2>
            Create Account
          </h2>

          <p>
            Start your fitness
            journey today
          </p>

          <form
            onSubmit={
              handleSubmit
            }
          >
            <label htmlFor="register-name">
              FULL NAME
            </label>

            <input
              id="register-name"
              type="text"
              name="name"
              placeholder="Enter your full name"
              value={name}
              onChange={
                handleChange
              }
              required
            />

            <label htmlFor="register-email">
              EMAIL ADDRESS
            </label>

            <input
              id="register-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={
                handleChange
              }
              required
            />

            <label htmlFor="register-password">
              PASSWORD
            </label>

            <input
              id="register-password"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={password}
              onChange={
                handleChange
              }
              required
            />

            <label htmlFor="register-confirm-password">
              CONFIRM PASSWORD
            </label>

            <input
              id="register-confirm-password"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Confirm your password"
              value={
                confirmPassword
              }
              onChange={
                handleChange
              }
              required
            />

            {formError && (
              <p className="register-error">{formError}</p>
            )}

            <button
              type="submit"
              className="register-btn"
            >
              Create Account
            </button>
          </form>

          <div className="login-link">
            Already have an
            account?{" "}
            <Link to="/">
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;