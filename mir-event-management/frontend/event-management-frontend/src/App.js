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

function AuditLogButton() {
  const [showAuditLog, setShowAuditLog] = useState(false);
  const location = useLocation();
  
  if (location.pathname.startsWith("/public")) {
    return null;
  }
  
  // חלץ eventId מה-URL
  const eventIdMatch = location.pathname.match(/\/events\/(\d+)/);
  const eventId = eventIdMatch ? parseInt(eventIdMatch[1]) : null;

  return (
    <div style={{
      position: "fixed",
      top: 20,
      left: 80,
      zIndex: 1000
    }}>
      <button
        onClick={() => setShowAuditLog(!showAuditLog)}
        className="theme-tropical"
        style={{
          background: "var(--color-surface, #FFFFFF)",
          border: "2px solid var(--color-primary-soft, #E0F7FA)",
          borderRadius: "50%",
          width: 48,
          height: 48,
          boxShadow: "0 4px 12px rgba(9, 176, 203, 0.2)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          color: "var(--color-primary, #09b0cb)",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(9, 176, 203, 0.3)";
          e.currentTarget.style.background = "var(--color-primary-soft, #E0F7FA)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(9, 176, 203, 0.2)";
          e.currentTarget.style.background = "var(--color-surface, #FFFFFF)";
        }}
        title="היסטוריית שינויים"
      >
        🕒
      </button>
      {showAuditLog && eventId && (
        <div 
          className="theme-tropical"
          style={{
            marginTop: 12,
            background: "var(--color-surface, #FFFFFF)",
            borderRadius: "16px",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.15)",
            border: "1px solid var(--color-border-light, #E1E5EC)",
            width: 380,
            maxHeight: 500,
            overflowY: "auto"
          }}
        >
          <AuditLog eventId={eventId} />
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <TropicalThemeProvider>
      <Router>
        <AuditLogButton />
        <TropicalThemeToggle />
        <AppRoutes />
      </Router>
    </TropicalThemeProvider>
  );
}

export default App;
