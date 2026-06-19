import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";

import Login from "./pages/login";
import Register from "./pages/register";
import Dashboard from "./pages/dashboard";
import Profile from "./pages/Profile";
import WorkoutHistory from "./pages/WorkoutHistory";
import Analytics from "./pages/Analytics";
import CalendarPage from "./pages/Calendar";
import Goals from "./pages/goals";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/workouts" element={<WorkoutHistory />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/goals" element={<Goals />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;