import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Dumbbell,
  BarChart3,
  TrendingUp,
  Calendar,
  Target,
  BookOpen,
  Search,
  MessageCircle,
  Compass,
  Menu,
  X,
} from "lucide-react";
import BrandMark from "./BrandMark";
import DarkModeToggle from "./DarkModeToggle";
import ProfileDropdown from "./ProfileDropdown";
import NotificationCenter from "./NotificationCenter";
import { listConversations } from "../services/chatService";
import * as chatSocket from "../services/chatSocket";
import "./Navbar.css";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workouts", label: "Workouts", icon: Dumbbell },
  { to: "/progression", label: "Progression", icon: TrendingUp },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/guidance", label: "Guidance", icon: Compass },
  { to: "/guide", label: "Guide", icon: BookOpen },
  { to: "/search", label: "Search", icon: Search },
  { to: "/messages", label: "Messages", icon: MessageCircle },
];

function Navbar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    listConversations()
      .then((res) => {
        const anyUnread = (res.data.conversations || []).some((c) => c.unreadCount > 0);
        setHasUnreadMessages(anyUnread);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return chatSocket.subscribe((event) => {
      if (event.type === "message:new") setHasUnreadMessages(true);
    });
  }, []);

  // Approximation, not a precise per-conversation read count: visiting the
  // Messages area clears the dot. Good enough for a nav-level "something's
  // new" indicator — the conversation list itself shows exact unread counts.
  useEffect(() => {
    if (location.pathname.startsWith("/messages")) setHasUnreadMessages(false);
  }, [location.pathname]);

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
      if (window.innerWidth > 1080) setMobileMenuOpen(false);
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
        <BrandMark size={22} />
        <span>Rep<span className="navbar-logo-dot">vyn</span></span>
      </Link>

      <div className="navbar-links">
        {NAV_LINKS.map(({ to, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`navbar-link ${active ? "navbar-link-active" : ""}`}
            >
              {label}
              {to === "/messages" && hasUnreadMessages && <span className="navbar-link-dot" />}
            </Link>
          );
        })}
      </div>

      <div className="navbar-right">
        <DarkModeToggle />

        <NotificationCenter />

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
              {to === "/messages" && hasUnreadMessages && <span className="navbar-link-dot" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default Navbar;