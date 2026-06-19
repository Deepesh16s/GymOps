import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Dumbbell, BarChart3, Calendar, User, LogOut, ChevronDown } from "lucide-react";
import DarkModeToggle from "./DarkModeToggle";
import "./Navbar.css";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workouts", label: "Workouts", icon: Dumbbell },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/calendar", label: "Calendar", icon: Calendar },
];

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const storedUser = JSON.parse(localStorage.getItem("user") || "null");

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <nav className="navbar">
      <Link to="/dashboard" className="navbar-logo">
        <div className="navbar-logo-icon">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M4 14l3-4 3 3 3-5 3 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span>Gym<span className="navbar-logo-dot">Ops</span></span>
      </Link>

      <div className="navbar-links">
        {NAV_LINKS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`navbar-link ${location.pathname === to ? "navbar-link-active" : ""}`}
          >
            <Icon size={16} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </div>

      <div className="navbar-right">
        <DarkModeToggle />

        <div className="navbar-profile" ref={dropdownRef}>
          <button
            type="button"
            className="navbar-profile-btn"
            onClick={() => setDropdownOpen((o) => !o)}
          >
            <span className="navbar-avatar">
              {storedUser?.name?.charAt(0).toUpperCase() || "?"}
            </span>
            <ChevronDown size={14} strokeWidth={2} />
          </button>

          {dropdownOpen && (
            <div className="navbar-dropdown">
              <div className="navbar-dropdown-header">
                <p className="navbar-dropdown-name">{storedUser?.name}</p>
                <p className="navbar-dropdown-email">{storedUser?.email}</p>
              </div>
              <Link
                to="/profile"
                className="navbar-dropdown-item"
                onClick={() => setDropdownOpen(false)}
              >
                <User size={15} strokeWidth={1.8} />
                Profile
              </Link>
              <button
                type="button"
                className="navbar-dropdown-item navbar-dropdown-logout"
                onClick={handleLogout}
              >
                <LogOut size={15} strokeWidth={1.8} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;