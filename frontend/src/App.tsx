import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import DashboardHome from "./pages/DashboardHome";
import LiveHub from "./pages/LiveHub";
import Impact from "./pages/Impact";
import About from "./pages/About";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Terms from "./pages/Terms";
import Calculator from "./pages/Calculator";
import CorporateDashboard from "./pages/CorporateDashboard";
import Profiles from "./pages/Profiles";


function CorporateOnly({ children }: { children: React.ReactNode }) {
  const kind = typeof window !== "undefined" ? localStorage.getItem("tl_account_kind") : null;
  if (kind !== "corporate") return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function HomeGate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const kind = localStorage.getItem("tl_account_kind");
    if (kind === "corporate") return <Navigate to="/app/corporate" replace />;
    return <Navigate to="/app" replace />;
  }
  return <Home />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeGate />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/terms" element={<Terms />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <DashboardHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/profiles"
              element={
                <ProtectedRoute>
                  <CorporateOnly>
                    <Profiles />
                  </CorporateOnly>
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/control"
              element={
                <ProtectedRoute>
                  <LiveHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/calculator"
              element={
                <ProtectedRoute>
                  <Calculator />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/corporate"
              element={
                <ProtectedRoute>
                  <CorporateDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/impact"
              element={
                <ProtectedRoute>
                  <Impact />
                </ProtectedRoute>
              }
            />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
