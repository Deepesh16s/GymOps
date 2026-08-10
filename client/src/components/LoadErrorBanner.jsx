import { AlertTriangle, RotateCw } from "lucide-react";
import "./LoadErrorBanner.css";

function LoadErrorBanner({
  message = "Something went wrong loading this page.",
  onRetry,
  className = "",
}) {
  return (
    <div className={`load-error-banner ${className}`.trim()} role="alert">
      <AlertTriangle size={16} strokeWidth={2} />
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="load-error-banner__retry" onClick={onRetry}>
          <RotateCw size={13} strokeWidth={2} />
          Retry
        </button>
      )}
    </div>
  );
}

export default LoadErrorBanner;
