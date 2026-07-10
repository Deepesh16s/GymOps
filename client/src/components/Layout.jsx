import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import "./Layout.css";

function Layout() {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-shell__content">
        <Outlet />
      </div>
    </div>
  );
}

export default Layout;