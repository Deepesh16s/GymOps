import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled render error:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong.</h1>
          <p style={{ color: "#64748b", margin: 0 }}>
            Please reload the page. If this keeps happening, try logging in
            again.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              marginTop: 8,
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              background: "#10b981",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
