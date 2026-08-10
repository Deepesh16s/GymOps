import { Bell, BellOff, BellRing } from "lucide-react";
import usePushNotifications from "../hooks/usePushNotifications";

function PermissionBadge({ permission }) {
  if (permission === "granted") {
    return (
      <span className="push-settings__badge push-settings__badge--granted">
        <BellRing size={12} strokeWidth={2} aria-hidden="true" /> Granted
      </span>
    );
  }
  if (permission === "denied") {
    return (
      <span className="push-settings__badge push-settings__badge--denied">
        <BellOff size={12} strokeWidth={2} aria-hidden="true" /> Denied
      </span>
    );
  }
  return (
    <span className="push-settings__badge push-settings__badge--default">
      <Bell size={12} strokeWidth={2} aria-hidden="true" /> Not enabled
    </span>
  );
}

function PushSettings() {
  const {
    supported,
    permission,
    subscribed,
    loading,
    preferences,
    requestAndSubscribe,
    unsubscribe,
    updatePreferences,
  } = usePushNotifications();

  if (!supported) {
    return (
      <div className="push-settings">
        <p className="notif-panel__preferences-label">Browser push</p>
        <p className="push-settings__unsupported">
          Not supported in this browser. The Notification Center still works fully in-app.
        </p>
      </div>
    );
  }

  const handleQuietHoursToggle = () => {
    updatePreferences({ quietHours: { enabled: !preferences?.quietHours?.enabled } });
  };

  const handleModeChange = (e) => {
    updatePreferences({ quietHours: { mode: e.target.value } });
  };

  const handleTimeChange = (field) => (e) => {
    updatePreferences({ quietHours: { [field]: e.target.value } });
  };

  return (
    <div className="push-settings">
      <p className="notif-panel__preferences-label">Browser push</p>

      <div className="push-settings__row">
        <PermissionBadge permission={permission} />
        {permission === "default" && (
          <button
            type="button"
            className="push-settings__action-btn"
            onClick={requestAndSubscribe}
            disabled={loading}
          >
            Enable notifications
          </button>
        )}
        {permission === "granted" && subscribed && (
          <button
            type="button"
            className="push-settings__action-btn push-settings__action-btn--muted"
            onClick={unsubscribe}
            disabled={loading}
          >
            Turn off
          </button>
        )}
        {permission === "granted" && !subscribed && (
          <button
            type="button"
            className="push-settings__action-btn"
            onClick={requestAndSubscribe}
            disabled={loading}
          >
            Turn on
          </button>
        )}
      </div>

      {permission === "denied" && (
        <p className="push-settings__hint">
          Blocked in your browser's own settings. Repvyn can't ask again — change it there if you'd
          like to re-enable push.
        </p>
      )}

      {subscribed && preferences && (
        <div className="push-settings__quiet-hours">
          <label className="notif-panel__preference-row">
            <input type="checkbox" checked={preferences.quietHours.enabled} onChange={handleQuietHoursToggle} />
            Quiet hours
          </label>
          {preferences.quietHours.enabled && (
            <div className="push-settings__quiet-hours-controls">
              <label className="push-settings__time-field">
                From
                <input
                  type="time"
                  value={preferences.quietHours.start}
                  onChange={handleTimeChange("start")}
                />
              </label>
              <label className="push-settings__time-field">
                To
                <input
                  type="time"
                  value={preferences.quietHours.end}
                  onChange={handleTimeChange("end")}
                />
              </label>
              <label className="push-settings__time-field">
                Mode
                <select value={preferences.quietHours.mode} onChange={handleModeChange}>
                  <option value="suppressAll">Suppress all</option>
                  <option value="criticalOnly">Critical only</option>
                  <option value="allow">Allow</option>
                </select>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PushSettings;
