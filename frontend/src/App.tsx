import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import LiveHub from "./pages/LiveHub";
import Impact from "./pages/Impact";
import About from "./pages/About";
import Terms from "./pages/Terms";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function HomeGate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  // Signed-in users land on live dashboard
  if (user) return <Navigate to="/app" replace />;
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
                  <LiveHub />
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
            <Route
              path="/about"
              element={
                <ProtectedRoute>
                  <About />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
