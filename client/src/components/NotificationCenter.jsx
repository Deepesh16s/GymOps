import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell as BellIcon, X, CheckCheck, Trash2, Sparkles, Clock, CheckCircle2, Settings, List, CalendarClock } from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  clearReadNotifications,
  snoozeNotification,
} from "../services/notificationService";
import { markPlannedWorkoutComplete } from "../services/plannedWorkoutService";
import {
  NOTIFICATION_FILTERS,
  getNotificationIcon,
  getNotificationTone,
  getNotificationPriority,
  getPriorityRank,
  REMINDER_PREFERENCE_CATEGORIES,
  REMINDER_PREFERENCE_LABELS,
} from "../constants/notificationTypes";
import { getReminderPreferences, setReminderPreference } from "../reminders/reminderPreferences";
import { groupRemindersByTimeline } from "../reminders/reminderTimeline";
import PushSettings from "./PushSettings";
import { formatRelativeTime } from "../utils/timeFormat";
import "./NotificationCenter.css";

// Phase 13C.1 — Deep Links: `action.focus` names a specific "what to do
// on arrival" behavior the destination page implements (WorkoutHistory's
// expandSession, Goals' scrollToGoal, Calendar's existing date focus —
// see each page's own deep-link effect). This is the one place that
// turns `action` into an actual URL, so every generator only has to
// stamp `action` correctly, not hand-build a matching query string
// itself. Falls back to the plain `navigationTarget` path for
// notifications with nothing specific to focus (action.focus is null).
function buildNavigationTarget(notification) {
  const { action, navigationTarget } = notification;
  if (!action?.focus || !action.entityId) return navigationTarget;

  switch (action.focus) {
    case "expandSession":
      return `/workouts?expandSession=${encodeURIComponent(action.entityId)}`;
    case "scrollToGoal":
      return `/goals?focusGoal=${encodeURIComponent(action.entityId)}`;
    case "date":
      return `/calendar?date=${encodeURIComponent(action.entityId)}`;
    default:
      return navigationTarget;
  }
}

// Polling interval for picking up server-triggered notifications
// (goal-recalculation-time PR/streak/goal events) generated outside the
// current tab — e.g. a session finished on another device. The SAME
// tab's own workout-finish flow doesn't wait for this: see
// useWorkoutSession.js's "gymops:notifications-created" event, handled
// below, for instant same-tab feedback. Entirely in-app polling, no
// push/service worker (out of scope for Phase 13A).
const POLL_INTERVAL_MS = 60000;

// Whole card is the click target (navigates + marks read) — a separate
// "View" button on every single row read as repetitive once there was
// nothing genuinely distinct about that action. Dismiss stays its own
// button (stopPropagation) since it's a different action from "open
// this". Cards with no navigationTarget at all render as plain,
// non-interactive rows (no click handler, no pointer cursor).
function NotificationItem({ notification, onNavigate, onDismiss, onSnooze, onMarkComplete, isNew }) {
  const Icon = getNotificationIcon(notification.icon);
  const tone = getNotificationTone(notification);
  const priority = getNotificationPriority(notification);
  const isClickable = !!notification.navigationTarget;
  const canMarkComplete = !!notification.metadata?.plannedWorkoutId;
  const explanation = notification.metadata?.explanation;
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const snoozeWrapRef = useRef(null);

  const handleDismissClick = (e) => {
    e.stopPropagation();
    onDismiss(notification._id);
  };

  const handleSnoozeToggle = (e) => {
    e.stopPropagation();
    setSnoozeOpen((o) => !o);
  };

  const handleSnoozePick = (e, until) => {
    e.stopPropagation();
    setSnoozeOpen(false);
    onSnooze(notification._id, until);
  };

  const handleMarkCompleteClick = (e) => {
    e.stopPropagation();
    onMarkComplete(notification);
  };

  useEffect(() => {
    if (!snoozeOpen) return undefined;
    const closeOnOutsideOrEscape = (e) => {
      if (e.type === "keydown") {
        if (e.key !== "Escape") return;
      } else if (snoozeWrapRef.current?.contains(e.target)) {
        return;
      }
      setSnoozeOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideOrEscape);
    document.addEventListener("keydown", closeOnOutsideOrEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideOrEscape);
      document.removeEventListener("keydown", closeOnOutsideOrEscape);
    };
  }, [snoozeOpen]);

  return (
    <li
      className={`notif-item notif-item--${tone} notif-item--priority-${priority} ${
        notification.read ? "notif-item--read" : "notif-item--unread"
      } ${isClickable ? "notif-item--clickable" : ""} ${isNew ? "notif-item--enter" : ""}`}
      onClick={isClickable ? () => onNavigate(notification) : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNavigate(notification);
              }
            }
          : undefined
      }
    >
      {!notification.read && <span className="notif-item__dot" aria-hidden="true" />}
      <div className="notif-item__icon">
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className="notif-item__body">
        <p className="notif-item__title">
          {priority === "critical" && (
            <span className="notif-item__priority-tag">Critical</span>
          )}
          {notification.title}
        </p>
        {notification.subtitle && (
          <p className="notif-item__subtitle">{notification.subtitle}</p>
        )}
        <span className="notif-item__time">
          {formatRelativeTime(notification.lastShownAt || notification.createdAt)}
          {/* Phase 13D, Part A.1 — Reminder Confidence: informational
              only, and only surfaced when it's LESS than full certainty
              (medium/low) — "High" is the expected baseline for most
              reminders, so showing it every time would just be noise;
              flagging the exception is what's actually useful. */}
          {notification.confidence && notification.confidence !== "high" && (
            <> · {notification.confidence === "medium" ? "Medium" : "Low"} confidence</>
          )}
          {/* Phase 13D, Part A.4 — Reminder Explanation: collapsed by
              default so it never adds visual weight to a card the user
              isn't curious about — see each generator's own comment for
              why these bullets are never invented, only itemized from
              values the reminder already computed. */}
          {explanation?.length > 0 && (
            <>
              {" · "}
              <button
                type="button"
                className="notif-item__why-btn"
                aria-expanded={whyOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setWhyOpen((o) => !o);
                }}
              >
                Why?
              </button>
            </>
          )}
        </span>
        {explanation?.length > 0 && whyOpen && (
          <ul className="notif-item__why-list">
            {explanation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="notif-item__actions">
        {canMarkComplete && (
          <button
            type="button"
            className="notif-item__action-btn"
            aria-label="Mark complete"
            title="Mark complete"
            onClick={handleMarkCompleteClick}
          >
            <CheckCircle2 size={13} strokeWidth={2} />
          </button>
        )}
        <div className="notif-item__snooze-wrap" ref={snoozeWrapRef}>
          <button
            type="button"
            className="notif-item__action-btn"
            aria-label="Snooze"
            aria-haspopup="true"
            aria-expanded={snoozeOpen}
            title="Snooze"
            onClick={handleSnoozeToggle}
          >
            <Clock size={13} strokeWidth={2} />
          </button>
          {snoozeOpen && (
            <div className="notif-item__snooze-menu" role="menu">
              <button type="button" role="menuitem" onClick={(e) => handleSnoozePick(e, "today")}>
                Snooze today
              </button>
              <button type="button" role="menuitem" onClick={(e) => handleSnoozePick(e, "tomorrow")}>
                Snooze tomorrow
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="notif-item__action-btn"
          aria-label="Dismiss notification"
          title="Dismiss"
          onClick={handleDismissClick}
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="notif-empty">
      <div className="notif-empty__icon">
        <Sparkles size={22} strokeWidth={1.6} />
      </div>
      <p className="notif-empty__title">You're all caught up.</p>
      <p className="notif-empty__sub">Continue training to unlock new milestones.</p>
    </div>
  );
}

function NotificationCenter() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  // Phase 13D, Part A.2 — Reminder Timeline: a presentation toggle only.
  // Same `filteredNotifications` array either way — "timeline" just
  // regroups it chronologically instead of rendering it flat. No new
  // fetch, no reminder-engine call.
  const [viewMode, setViewMode] = useState("list");
  const [loading, setLoading] = useState(true);
  const [justBumped, setJustBumped] = useState(false);
  // IDs that should still play their slide-in entrance animation — only
  // ever populated by the instant same-tab "notifications-created"
  // event (a poll-fetched refresh is never "new" the same way), cleared
  // ~1s later so it never replays on a later re-render of the same item.
  const [recentlyAddedIds, setRecentlyAddedIds] = useState(() => new Set());
  // Phase 13C, section 13 — preferences panel, and its own snapshot of
  // getReminderPreferences() so toggling re-renders the panel without
  // re-reading localStorage on every keystroke.
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferences, setPreferences] = useState(() => getReminderPreferences());

  const wrapRef = useRef(null);
  const bellButtonRef = useRef(null);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Instant same-tab feedback — see useWorkoutSession.js's finishWorkout,
  // which dispatches this the moment a session-save response comes back
  // with new notifications, rather than waiting for the next poll tick.
  useEffect(() => {
    const handleCreated = (e) => {
      const created = e.detail || [];
      if (!created.length) return;
      setNotifications((prev) => [...created, ...prev]);
      setUnreadCount((prev) => prev + created.filter((n) => !n.read).length);
      setJustBumped(true);
      setTimeout(() => setJustBumped(false), 900);

      const newIds = created.map((n) => n._id);
      setRecentlyAddedIds((prev) => new Set([...prev, ...newIds]));
      setTimeout(() => {
        setRecentlyAddedIds((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 1000);
    };
    window.addEventListener("gymops:notifications-created", handleCreated);
    return () => window.removeEventListener("gymops:notifications-created", handleCreated);
  }, []);

  // Outside click closes the panel — same pattern ProfileDropdown/Navbar's
  // mobile menu already use.
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Escape closes the panel and returns focus to the bell — standard
  // disclosure-widget behavior (matches native <dialog>/menu semantics).
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        bellButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Minimal focus trap: on open, move focus into the panel; Tab/Shift+Tab
  // wraps within it rather than escaping to the page behind it.
  useEffect(() => {
    if (!open || !panelRef.current) return undefined;

    const panel = panelRef.current;
    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((el) => !el.disabled);

    const focusable = getFocusable();
    (focusable[0] || panel).focus();

    const handleTab = (e) => {
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener("keydown", handleTab);
    return () => panel.removeEventListener("keydown", handleTab);
  }, [open]);

  // Section 9 — "Notification Center should sort automatically": highest
  // priority first, then newest-first within the same tier. Sorting here
  // (render time) rather than trusting server order keeps this correct
  // even for the same-tab instant-insert path (handleCreated below just
  // prepends), which doesn't re-sort on its own.
  const filteredNotifications = useMemo(() => {
    const base =
      filter === "all"
        ? notifications
        : filter === "unread"
        ? notifications.filter((n) => !n.read)
        : notifications.filter((n) => n.category === filter);

    return [...base].sort((a, b) => {
      const rankDiff = getPriorityRank(getNotificationPriority(a)) - getPriorityRank(getNotificationPriority(b));
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.lastShownAt || b.createdAt) - new Date(a.lastShownAt || a.createdAt);
    });
  }, [notifications, filter]);

  const handleNavigate = async (notification) => {
    if (!notification.read) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await markNotificationRead(notification._id);
      } catch (error) {
        console.log(error);
      }
    }
    setOpen(false);
    const target = buildNavigationTarget(notification);
    if (target) navigate(target);
  };

  const handleDismiss = async (id) => {
    const wasUnread = notifications.find((n) => n._id === id)?.read === false;
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await dismissNotification(id);
    } catch (error) {
      console.log(error);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch (error) {
      console.log(error);
    }
  };

  const handleClearRead = async () => {
    setNotifications((prev) => prev.filter((n) => !n.read));
    try {
      await clearReadNotifications();
    } catch (error) {
      console.log(error);
    }
  };

  // Section 11 — snooze removes it from view immediately (same optimistic
  // pattern as dismiss), but it's not gone for good: getNotifications
  // stops excluding it once snoozedUntil passes, so it reappears in a
  // later fetch on its own, no extra client bookkeeping needed.
  const handleSnooze = async (id, until) => {
    const wasUnread = notifications.find((n) => n._id === id)?.read === false;
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await snoozeNotification(id, until);
    } catch (error) {
      console.log(error);
    }
  };

  // Section 11 — "Mark complete": for a reminder tied to a planned
  // workout, this both dismisses the reminder AND marks that plan
  // Completed via the existing planner endpoint — composed here client-
  // side rather than a new server endpoint (see plannedWorkoutService.js,
  // already used identically by Calendar's own missed-workout actions).
  const handleMarkComplete = async (notification) => {
    const planId = notification.metadata?.plannedWorkoutId;
    const wasUnread = !notification.read;
    setNotifications((prev) => prev.filter((n) => n._id !== notification._id));
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      if (planId) await markPlannedWorkoutComplete(planId);
      await dismissNotification(notification._id);
    } catch (error) {
      console.log(error);
    }
  };

  const handleTogglePreference = (category) => {
    const enabled = preferences[category] !== false;
    setPreferences(setReminderPreference(category, !enabled));
  };

  const hasReadItems = notifications.some((n) => n.read);

  return (
    <div className="notif-center" ref={wrapRef}>
      <button
        type="button"
        ref={bellButtonRef}
        className={`notif-bell ${justBumped ? "notif-bell--bump" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <BellIcon size={19} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className={`notif-bell__badge ${justBumped ? "notif-bell__badge--pop" : ""}`}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <div
        ref={panelRef}
        className={`notif-panel ${open ? "notif-panel--open" : ""}`}
        role="dialog"
        aria-label="Notifications"
        aria-modal="false"
        tabIndex={-1}
      >
        <div className="notif-panel__header">
          <div className="notif-panel__header-row">
            <h3>Notifications</h3>
            <div className="notif-panel__header-actions">
              <button
                type="button"
                className="notif-panel__action notif-panel__action--primary"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
              >
                <CheckCheck size={13} strokeWidth={2} />
                Mark all read
              </button>
              <button
                type="button"
                className="notif-panel__action notif-panel__action--icon"
                aria-label="Reminder preferences"
                aria-expanded={preferencesOpen}
                onClick={() => setPreferencesOpen((o) => !o)}
              >
                <Settings size={13} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="notif-panel__header-row">
            {unreadCount > 0 ? (
              <span className="notif-panel__unread-count">{unreadCount} unread</span>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="notif-panel__action"
              onClick={handleClearRead}
              disabled={!hasReadItems}
            >
              <Trash2 size={13} strokeWidth={2} />
              Clear read
            </button>
          </div>
        </div>

        {preferencesOpen && (
          <div className="notif-panel__preferences">
            <p className="notif-panel__preferences-label">Reminder categories</p>
            {Object.values(REMINDER_PREFERENCE_CATEGORIES).map((category) => (
              <label key={category} className="notif-panel__preference-row">
                <input
                  type="checkbox"
                  checked={preferences[category] !== false}
                  onChange={() => handleTogglePreference(category)}
                />
                {REMINDER_PREFERENCE_LABELS[category]}
              </label>
            ))}
            <PushSettings />
          </div>
        )}

        <div className="notif-panel__filters" role="tablist" aria-label="Filter notifications">
          {NOTIFICATION_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`notif-filter-tab ${filter === f.key ? "notif-filter-tab--active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
          <div className="notif-panel__view-toggle" role="group" aria-label="Reminder view">
            <button
              type="button"
              className={`notif-view-btn ${viewMode === "list" ? "notif-view-btn--active" : ""}`}
              aria-pressed={viewMode === "list"}
              aria-label="List view"
              title="List view"
              onClick={() => setViewMode("list")}
            >
              <List size={13} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={`notif-view-btn ${viewMode === "timeline" ? "notif-view-btn--active" : ""}`}
              aria-pressed={viewMode === "timeline"}
              aria-label="Timeline view"
              title="Timeline view"
              onClick={() => setViewMode("timeline")}
            >
              <CalendarClock size={13} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="notif-panel__list-wrap">
          {loading ? (
            <div className="notif-panel__loading">
              {[1, 2, 3].map((i) => (
                <span key={i} className="skeleton" style={{ height: 56, borderRadius: 10, display: "block", marginBottom: 8 }} />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <EmptyState />
          ) : viewMode === "timeline" ? (
            <div className="notif-timeline">
              {groupRemindersByTimeline(filteredNotifications).map((group) => (
                <div key={group.label} className="notif-timeline__group">
                  <p className="notif-timeline__label">{group.label}</p>
                  <ul className="notif-panel__list">
                    {group.items.map((n) => (
                      <NotificationItem
                        key={n._id}
                        notification={n}
                        onNavigate={handleNavigate}
                        onDismiss={handleDismiss}
                        onSnooze={handleSnooze}
                        onMarkComplete={handleMarkComplete}
                        isNew={recentlyAddedIds.has(n._id)}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="notif-panel__list">
              {filteredNotifications.map((n) => (
                <NotificationItem
                  key={n._id}
                  notification={n}
                  onNavigate={handleNavigate}
                  onDismiss={handleDismiss}
                  onSnooze={handleSnooze}
                  onMarkComplete={handleMarkComplete}
                  isNew={recentlyAddedIds.has(n._id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationCenter;
