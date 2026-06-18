import "./Navbar.css";

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <div className="logo-box">
          ↗
        </div>

        <h2>
          Gym<span>Ops</span>
        </h2>
      </div>

      <div className="profile-circle">
        D
      </div>
    </nav>
  );
}

export default Navbar;