import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Dumbbell,
  BarChart3,
  Calendar,
  Target,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import DarkModeToggle from "./DarkModeToggle";
import "./Navbar.css";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workouts", label: "Workouts", icon: Dumbbell },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/goals", label: "Goals", icon: Target },
];

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  const storedUser = JSON.parse(localStorage.getItem("user") || "null");

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Purely visual: adds a deeper shadow once the page scrolls.
  // Does not affect any data, routing, or auth logic.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu automatically if the viewport grows past
  // the breakpoint (e.g. rotating a tablet, resizing a browser window).
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 900) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close the mobile menu on route change (covers link clicks reliably,
  // including keyboard/Enter activation, not just pointer clicks).
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <nav className={`navbar ${scrolled ? "navbar-scrolled" : ""}`}>
      <Link to="/dashboard" className="navbar-logo">
        <div className="navbar-logo-icon">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M4 14l3-4 3 3 3-5 3 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span>Gym<span className="navbar-logo-dot">Ops</span></span>
      </Link>

      {/* Desktop nav links — hidden under 900px via CSS */}
      <div className="navbar-links">
        {NAV_LINKS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`navbar-link ${active ? "navbar-link-active" : ""}`}
            >
              <Icon size={16} strokeWidth={1.8} />
              {label}
              <span className="navbar-link-indicator" />
            </Link>
          );
        })}
      </div>

      <div className="navbar-right">
        <DarkModeToggle />

        <div className="navbar-profile" ref={dropdownRef}>
          <button
            type="button"
            className="navbar-profile-btn"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <span className="navbar-avatar">
              {storedUser?.name?.charAt(0).toUpperCase() || "?"}
            </span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={`navbar-chevron ${dropdownOpen ? "navbar-chevron-open" : ""}`}
            />
          </button>

          <div className={`navbar-dropdown ${dropdownOpen ? "navbar-dropdown-open" : ""}`}>
            <div className="navbar-dropdown-header">
              <span className="navbar-dropdown-avatar">
                {storedUser?.name?.charAt(0).toUpperCase() || "?"}
              </span>
              <div>
                <p className="navbar-dropdown-name">{storedUser?.name}</p>
                <p className="navbar-dropdown-email">{storedUser?.email}</p>
              </div>
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
        </div>

        {/* Hamburger trigger — visible only under 900px via CSS */}
        <button
          type="button"
          className="navbar-hamburger"
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-expanded={mobileMenuOpen}
          aria-controls="navbar-mobile-menu"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? (
            <X size={20} strokeWidth={2} />
          ) : (
            <Menu size={20} strokeWidth={2} />
          )}
        </button>
      </div>

      {/* Mobile slide-down menu */}
      <div
        id="navbar-mobile-menu"
        ref={mobileMenuRef}
        className={`navbar-mobile-menu ${mobileMenuOpen ? "navbar-mobile-menu-open" : ""}`}
      >
        {NAV_LINKS.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`navbar-mobile-link ${active ? "navbar-mobile-link-active" : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default Navbar;