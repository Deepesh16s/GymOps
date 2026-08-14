import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, LogOut, ChevronDown, AtSign, UserPlus } from "lucide-react";
import useModalEscapeAndFocus from "../hooks/useModalEscapeAndFocus";
import Avatar from "./Avatar";
import "./ProfileDropdown.css";

const readStoredUser = () => JSON.parse(localStorage.getItem("user") || "null");

function ProfileDropdown() {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [storedUser, setStoredUser] = useState(readStoredUser);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleUserUpdated = () => setStoredUser(readStoredUser());
    window.addEventListener("repvyn:user-updated", handleUserUpdated);
    return () =>
      window.removeEventListener("repvyn:user-updated", handleUserUpdated);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCloseDropdown = useCallback(() => setDropdownOpen(false), []);
  useModalEscapeAndFocus(dropdownOpen, handleCloseDropdown);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="navbar-profile" ref={dropdownRef}>
      <div className="navbar-profile-btn">
        {storedUser?.username ? (
          <Link to={`/u/${storedUser.username}`} className="navbar-avatar" aria-label="View public profile">
            <Avatar src={storedUser?.picture} name={storedUser?.name} imgClassName="navbar-avatar-img" />
          </Link>
        ) : (
          <span className="navbar-avatar">
            <Avatar src={storedUser?.picture} name={storedUser?.name} imgClassName="navbar-avatar-img" />
          </span>
        )}
        <button
          type="button"
          className="navbar-profile-chevron-btn"
          onClick={() => setDropdownOpen((o) => !o)}
          aria-expanded={dropdownOpen}
          aria-haspopup="true"
          aria-label="Open profile menu"
        >
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={`navbar-chevron ${dropdownOpen ? "navbar-chevron-open" : ""}`}
          />
        </button>
      </div>

      <div className={`navbar-dropdown ${dropdownOpen ? "navbar-dropdown-open" : ""}`}>
        <div className="navbar-dropdown-header">
          <span className="navbar-dropdown-avatar">
            <Avatar src={storedUser?.picture} name={storedUser?.name} imgClassName="navbar-avatar-img" />
          </span>
          <div>
            <p className="navbar-dropdown-name">{storedUser?.name}</p>
            {storedUser?.username && (
              <p className="navbar-dropdown-username">@{storedUser.username}</p>
            )}
            <p className="navbar-dropdown-email">{storedUser?.email}</p>
          </div>
        </div>
        <Link
          to="/profile"
          className="navbar-dropdown-item"
          onClick={() => setDropdownOpen(false)}
        >
          <User size={15} strokeWidth={1.8} />
          Profile Settings
        </Link>
        {storedUser?.username && (
          <Link
            to={`/u/${storedUser.username}`}
            className="navbar-dropdown-item"
            onClick={() => setDropdownOpen(false)}
          >
            <AtSign size={15} strokeWidth={1.8} />
            View public profile
          </Link>
        )}
        <Link
          to="/follow-requests"
          className="navbar-dropdown-item"
          onClick={() => setDropdownOpen(false)}
        >
          <UserPlus size={15} strokeWidth={1.8} />
          Follow Requests
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
  );
}

export default ProfileDropdown;