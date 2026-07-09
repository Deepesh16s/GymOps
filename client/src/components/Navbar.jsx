import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Dumbbell,
  BarChart3,
  Calendar,
  Target,
  BookOpen,
  Menu,
  X,
} from "lucide-react";
import DarkModeToggle from "./DarkModeToggle";
import ProfileDropdown from "./ProfileDropdown";
import "./Navbar.css";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workouts", label: "Workouts", icon: Dumbbell },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/guide", label: "Guide", icon: BookOpen },
];

function Navbar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 900) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

        <ProfileDropdown />

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