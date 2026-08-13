import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail,
  CalendarDays,
  Pencil,
  Lock,
  Trash2,
  AtSign,
} from "lucide-react";

import "./profile.css";
import api from "../services/api";

function Profile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");

  const [username, setUsername] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState("");
  const [usernameStatus, setUsernameStatus] = useState("idle"); // idle | checking | available | taken
  const usernameCheckId = useRef(0);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [savingPassword, setSavingPassword] =
    useState(false);
  const [passwordMsg, setPasswordMsg] =
    useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/auth/me");

        setUser(res.data);
        setName(res.data.name || "");
        setUsername(res.data.username || "");
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Live availability check as the user edits their username — the actual
  // guarantee is server-side on save, this is UX only.
  useEffect(() => {
    if (!username || username === user?.username) {
      setUsernameStatus("idle");
      return;
    }

    const checkId = ++usernameCheckId.current;
    setUsernameStatus("checking");
    const handle = setTimeout(async () => {
      try {
        const res = await api.get("/auth/username-available", { params: { username } });
        if (checkId !== usernameCheckId.current) return;
        setUsernameStatus(res.data.available ? "available" : "taken");
        setUsernameMsg(res.data.available ? "" : res.data.message || "Username is already taken");
      } catch (error) {
        if (checkId !== usernameCheckId.current) return;
        console.log(error);
        setUsernameStatus("idle");
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [username, user?.username]);

  const handleUsernameSave = async (e) => {
    e.preventDefault();
    setUsernameMsg("");

    if (usernameStatus === "taken" || usernameStatus === "checking") return;

    setSavingUsername(true);
    try {
      const res = await api.put("/auth/username", { username });
      setUser(res.data.user);

      const storedUser = JSON.parse(localStorage.getItem("user") || "null");
      if (storedUser) {
        localStorage.setItem("user", JSON.stringify({ ...storedUser, username: res.data.user.username }));
        window.dispatchEvent(new Event("repvyn:user-updated"));
      }

      setUsernameMsg("Username updated successfully.");
    } catch (error) {
      setUsernameMsg(error.response?.data?.message || "Could not update username.");
    } finally {
      setSavingUsername(false);
    }
  };

  const handleNameSave = async (e) => {
    e.preventDefault();

    setNameMsg("");

    if (!name.trim()) {
      setNameMsg(
        "Name can't be empty."
      );
      return;
    }

    setSavingName(true);

    try {
      const res = await api.put(
        "/auth/profile",
        {
          name: name.trim(),
        }
      );

      setUser(res.data.user);

      localStorage.setItem(
        "user",
        JSON.stringify(
          res.data.user
        )
      );
      window.dispatchEvent(new Event("repvyn:user-updated"));

      setNameMsg(
        "Profile updated successfully."
      );
    } catch (error) {
      setNameMsg(
        error.response?.data
          ?.message ||
        "Could not update name."
      );
    } finally {
      setSavingName(false);
    }
  };

  const handlePasswordChange =
    async (e) => {
      e.preventDefault();

      setPasswordMsg("");
      if (!oldPassword) {
        setPasswordMsg(
          "Please enter your current password."
        );
        return;
      }

      if (
        newPassword.length < 6
      ) {
        setPasswordMsg(
          "Password must be at least 6 characters."
        );
        return;
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        setPasswordMsg(
          "Passwords don't match."
        );
        return;
      }

      setSavingPassword(true);

      try {
        await api.put(
          "/auth/change-password",
          {
            oldPassword,
            newPassword,
          }
        );

        setPasswordMsg(
          "Password updated successfully."
        );
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch (error) {
        setPasswordMsg(
          error.response?.data
            ?.message ||
          "Could not change password."
        );
      } finally {
        setSavingPassword(false);
      }
    };

  const handleDeleteAccount =
    async () => {
      setDeleting(true);

      try {
        await api.delete(
          "/auth/account"
        );

        localStorage.removeItem(
          "token"
        );

        localStorage.removeItem(
          "user"
        );

        navigate("/");
      } catch (error) {
        console.log(error);
        setDeleting(false);
      }
    };

  const joinedDate =
    user?.createdAt
      ? new Date(
        user.createdAt
      ).toLocaleDateString(
        undefined,
        {
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      )
      : null;

  if (loading) {
    return (
      <div className="profile-page">
        <main className="profile-main">
          <div className="profile-placeholder">
            <h1>Profile</h1>
            <p>
              Loading your
              profile...
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <main className="profile-main">
        <div className="profile-grid">

          <section className="profile-card profile-hero-card">
            <div className="profile-avatar">
              {user?.name
                ?.charAt(0)
                .toUpperCase() ||
                "?"}
            </div>

            <h1 className="profile-name">
              {user?.name}
            </h1>

            {user?.username && (
              <p className="profile-username">
                <AtSign size={14} />
                {user.username}
              </p>
            )}

            <p className="profile-email">
              <Mail size={16} />
              {user?.email}
            </p>

            {joinedDate && (
              <p className="profile-joined">
                <CalendarDays
                  size={16}
                />
                Joined{" "}
                {joinedDate}
              </p>
            )}

            {user?.username && (
              <Link to={`/u/${user.username}`} className="profile-view-public">
                View public profile
              </Link>
            )}
          </section>

          <section className="profile-card">
            <div className="profile-section-header">
              <AtSign size={20} />

              <h2 className="profile-card-title">
                Username
              </h2>
            </div>

            <form className="profile-form" onSubmit={handleUsernameSave}>
              <label className="profile-label" htmlFor="username">
                Username
              </label>

              <input
                id="username"
                className="profile-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                minLength={3}
                maxLength={20}
                pattern="[a-z0-9_]+"
              />

              {usernameStatus === "checking" && (
                <p className="profile-msg">Checking availability...</p>
              )}
              {usernameStatus === "available" && (
                <p className="profile-msg">@{username} is available</p>
              )}

              <button
                className="profile-btn"
                type="submit"
                disabled={savingUsername || usernameStatus === "taken" || usernameStatus === "checking"}
              >
                {savingUsername ? "Saving..." : "Save Username"}
              </button>

              {usernameMsg && (
                <p className="profile-msg">
                  {usernameMsg}
                </p>
              )}
            </form>
          </section>


          <section className="profile-card">
            <div className="profile-section-header">
              <Pencil size={20} />

              <h2 className="profile-card-title">
                Edit Profile
              </h2>
            </div>

            <form
              className="profile-form"
              onSubmit={
                handleNameSave
              }
            >
              <label
                className="profile-label"
                htmlFor="name"
              >
                Name
              </label>

              <input
                id="name"
                className="profile-input"
                type="text"
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
              />

              <button
                className="profile-btn"
                type="submit"
                disabled={
                  savingName
                }
              >
                {savingName
                  ? "Saving..."
                  : "Save Changes"}
              </button>

              {nameMsg && (
                <p className="profile-msg">
                  {nameMsg}
                </p>
              )}
            </form>
          </section>


          <section className="profile-card">
            <div className="profile-section-header">
              <Lock size={20} />

              <h2 className="profile-card-title">
                Security
              </h2>
            </div>

            <form
              className="profile-form"
              onSubmit={
                handlePasswordChange
              }
            >
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={user?.email || ""}
                readOnly
                hidden
              />

              <label
                className="profile-label"
                htmlFor="oldPassword"
              >
                Current Password
              </label>

              <input
                id="oldPassword"
                className="profile-input"
                type="password"
                autoComplete="current-password"
                placeholder="Enter current password"
                value={oldPassword}
                onChange={(e) =>
                  setOldPassword(e.target.value)
                }
              />
              <label
                className="profile-label"
                htmlFor="newPassword"
              >
                New Password
              </label>

              <input
                id="newPassword"
                className="profile-input"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={
                  newPassword
                }
                onChange={(e) =>
                  setNewPassword(
                    e.target.value
                  )
                }
              />

              <label
                className="profile-label"
                htmlFor="confirmPassword"
              >
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                className="profile-input"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={
                  confirmPassword
                }
                onChange={(e) =>
                  setConfirmPassword(
                    e.target.value
                  )
                }
              />

              <button
                className="profile-btn"
                type="submit"
                disabled={
                  savingPassword
                }
              >
                {savingPassword
                  ? "Updating..."
                  : "Update Password"}
              </button>

              {passwordMsg && (
                <p className="profile-msg">
                  {passwordMsg}
                </p>
              )}
            </form>
          </section>


          <section className="profile-card profile-danger">
            <div className="profile-section-header">
              <Trash2
                size={20}
              />

              <h2 className="profile-card-title profile-danger-title">
                Danger Zone
              </h2>
            </div>

            <p className="profile-danger-text">
              Deleting your
              account permanently
              removes all your
              workouts, analytics,
              records and history.
            </p>

            {!showDeleteConfirm ? (
              <button
                className="profile-btn profile-btn-danger"
                type="button"
                onClick={() =>
                  setShowDeleteConfirm(
                    true
                  )
                }
              >
                Delete Account
              </button>
            ) : (
              <div className="profile-confirm-row">
                <button
                  className="profile-btn profile-btn-danger"
                  type="button"
                  onClick={
                    handleDeleteAccount
                  }
                  disabled={
                    deleting
                  }
                >
                  {deleting
                    ? "Deleting..."
                    : "Yes, Delete"}
                </button>

                <button
                  className="profile-btn profile-btn-ghost"
                  type="button"
                  onClick={() =>
                    setShowDeleteConfirm(
                      false
                    )
                  }
                  disabled={
                    deleting
                  }
                >
                  Cancel
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default Profile;