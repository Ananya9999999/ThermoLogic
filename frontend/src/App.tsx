import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Demo from "./pages/Demo";
import Impact from "./pages/Impact";
import Architecture from "./pages/Architecture";
import About from "./pages/About";
import Terms from "./pages/Terms";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/impact" element={<Impact />} />
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/about" element={<About />} />
          <Route path="/terms" element={<Terms />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
