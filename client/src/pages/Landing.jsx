import { Link, Navigate } from "react-router-dom";
import { Dumbbell, LineChart, Target, Activity, ChevronDown } from "lucide-react";
import hero from "../assets/hero.jpg";
import BrandMark from "../components/BrandMark";
import Reveal from "../components/Reveal";
import "./Landing.css";

const FEATURES = [
  { icon: Dumbbell, label: "Workout Logging", desc: "Sets, reps, and live session tracking." },
  { icon: Activity, label: "Muscle Body Map", desc: "See exactly what you've trained, and what you haven't." },
  { icon: LineChart, label: "Progression", desc: "Personal records and per-muscle trend charts." },
  { icon: Target, label: "Goals", desc: "Strength, volume, and streak targets that track themselves." },
];

function Landing() {
  if (localStorage.getItem("token")) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="land-page">
      <div className="land-atmosphere">
        <img src={hero} alt="" aria-hidden="true" className="land-bg-photo" />
        <div className="land-glow land-glow--1" />
        <div className="land-glow land-glow--2" />
      </div>

      <header className="land-topbar motion-enter">
        <Link to="/" className="land-brand">
          <BrandMark size={22} />
          <span>Rep<span className="land-brand-accent">vyn</span></span>
        </Link>
        <Link to="/login" className="land-nav-signin">Sign In</Link>
      </header>

      <main className="land-hero">
        <p className="land-eyebrow motion-enter-blur motion-stagger-1">Training intelligence, not guesswork</p>
        <h1 className="land-heading motion-enter-blur motion-stagger-2">
          Track workouts.
          <br />
          Understand your strength.
          <br />
          <span className="land-heading-accent">Visualize your progress.</span>
        </h1>
        <p className="land-sub motion-enter motion-stagger-3">
          Repvyn turns your logged sets into recovery, progression, and muscle-balance insight —
          computed from your own training history, not a black box.
        </p>
        <div className="land-cta-row motion-enter motion-stagger-4">
          <Link to="/register" className="land-cta-primary">Start Training</Link>
          <Link to="/login" className="land-cta-secondary">Sign In</Link>
        </div>

        <span className="land-scroll-cue" aria-hidden="true">
          <ChevronDown size={18} strokeWidth={1.8} />
        </span>
      </main>

      <section className="land-features">
        {FEATURES.map(({ icon: Icon, label, desc }) => (
          <Reveal as="div" className="land-feature" key={label}>
            <Icon size={18} strokeWidth={1.8} className="land-feature-icon" />
            <p className="land-feature-label">{label}</p>
            <p className="land-feature-desc">{desc}</p>
          </Reveal>
        ))}
      </section>

      <footer className="land-footer">
        <span>&copy; {new Date().getFullYear()} Repvyn</span>
      </footer>
    </div>
  );
}

export default Landing;
