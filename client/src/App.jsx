import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";

import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import ErrorBoundary from "./components/ErrorBoundary";
import Landing from "./pages/Landing";
import Login from "./pages/login";
import Register from "./pages/register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

const Dashboard = lazy(() => import("./pages/dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const WorkoutHistory = lazy(() => import("./pages/WorkoutHistory"));
const Progression = lazy(() => import("./pages/Progression"));
const Analytics = lazy(() => import("./pages/Analytics"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const Goals = lazy(() => import("./pages/Goals"));
const Guide = lazy(() => import("./pages/Guide"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const UserSearch = lazy(() => import("./pages/UserSearch"));
const FollowList = lazy(() => import("./pages/FollowList"));
const Messages = lazy(() => import("./pages/Messages"));
const Conversation = lazy(() => import("./pages/Conversation"));
const Guidance = lazy(() => import("./pages/Guidance"));
const FollowRequests = lazy(() => import("./pages/FollowRequests"));
const Feed = lazy(() => import("./pages/Feed"));

function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-label="Loading page">
      <div className="route-loading__spinner" />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />

              <Route
                element={
                  <RequireAuth>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/workouts" element={<WorkoutHistory />} />
                <Route path="/progression" element={<Progression />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/goals" element={<Goals />} />
                <Route path="/guide" element={<Guide />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/search" element={<UserSearch />} />
                <Route path="/u/:username" element={<PublicProfile />} />
                <Route path="/u/:username/followers" element={<FollowList mode="followers" />} />
                <Route path="/u/:username/following" element={<FollowList mode="following" />} />
                <Route path="/messages" element={<Messages />} />
                <Route path="/messages/:id" element={<Conversation />} />
                <Route path="/guidance" element={<Guidance />} />
                <Route path="/follow-requests" element={<FollowRequests />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;