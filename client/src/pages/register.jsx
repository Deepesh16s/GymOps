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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]:
        e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      password !== confirmPassword
    ) {
      alert(
        "Passwords do not match"
      );
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

      alert(
        "Registration Successful"
      );

      navigate("/");
    } catch (error) {
      console.log(error);

      alert(
        error.response?.data
          ?.message ||
          "Registration Failed"
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
              ↗
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
              🏋️ Workouts
            </span>

            <span>
              📈 Analytics
            </span>

            <span>
              🥗 Nutrition
            </span>
          </div>
        </div>
      </div>

      <div className="register-right">
        <div className="register-card">
          <div className="card-logo">
            <div className="logo-icon">
              ↗
            </div>

            <h3>GymOps</h3>
          </div>

          <h2>
            Create Account 🚀
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
            <label>
              FULL NAME
            </label>

            <input
              type="text"
              name="name"
              placeholder="Enter your full name"
              value={name}
              onChange={
                handleChange
              }
              required
            />

            <label>
              EMAIL ADDRESS
            </label>

            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={email}
              onChange={
                handleChange
              }
              required
            />

            <label>
              PASSWORD
            </label>

            <input
              type="password"
              name="password"
              placeholder="Create a password"
              value={password}
              onChange={
                handleChange
              }
              required
            />

            <label>
              CONFIRM PASSWORD
            </label>

            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm your password"
              value={
                confirmPassword
              }
              onChange={
                handleChange
              }
              required
            />

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