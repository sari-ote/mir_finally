import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { TropicalThemeProvider } from "./contexts/TropicalThemeContext";
import Login from "./components/Login/Login";
import AdminDashboard from "./components/AdminDashboard";
import EventPage from "./components/EventTabs/EventPage"; // ✅ ייבוא הקובץ החדש
import AuditLog from "./components/AuditLog";
import PublicFormPage from "./pages/PublicFormPage";
import TropicalDesignDemo from "./pages/TropicalDesignDemo";
import TropicalThemeToggle from "./components/TropicalThemeToggle";
import TopActionButtons from "./components/TopActionButtons";
import Footer from "./components/Footer";

function AppRoutes() {
  const location = useLocation();
  const isLogin = location.pathname === "/";

  React.useEffect(() => {
    if (!isLogin) {
      document.body.classList.add("main-bg");
    } else {
      document.body.classList.remove("main-bg");
    }
    return () => document.body.classList.remove("main-bg");
  }, [isLogin]);

  return (
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/events/:eventId" element={<EventPage />} /> {/* ✅ ראוט חדש */}
        <Route path="/public/forms/:token" element={<PublicFormPage />} />
        <Route path="/tropical-demo" element={<TropicalDesignDemo />} />
      </Routes>
  );
}

function App() {
  return (
    <TropicalThemeProvider>
      <Router>
        <TopActionButtons />
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1 }}>
            <AppRoutes />
          </div>
          <Footer />
        </div>
      </Router>
    </TropicalThemeProvider>
  );
}

export default App;
