import React, { useMemo, useState } from "react";
import UserManagement from "./EventTabs/UserManagement";
import "../styles/theme-tropical.css";

export default function UserProfilePanel({ eventId }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showManagement, setShowManagement] = useState(false);

  const username = localStorage.getItem("username") || "משתמש";
  const fullName = localStorage.getItem("full_name") || username;
  const role = localStorage.getItem("role") || "viewer";

  const initials = useMemo(() => {
    const parts = String(fullName).trim().split(/\s+/);
    const letters = (parts[0]?.[0] || "").concat(parts[1]?.[0] || "");
    return letters.toUpperCase() || "?";
  }, [fullName]);

  return (
    <div dir="rtl">
      {/* Floating profile button */}
      <button
        aria-label="פרופיל משתמש"
        onClick={() => setMenuOpen(v => !v)}
        className="theme-tropical"
        style={{
          position: "fixed",
          top: 20,
          left: 20,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--color-primary, #09b0cb)",
          color: "white",
          border: "2px solid var(--color-primary-dark, #067a8a)",
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(9, 176, 203, 0.3)",
          fontWeight: 700,
          zIndex: 1100,
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
          e.currentTarget.style.boxShadow = "0 6px 20px rgba(9, 176, 203, 0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(9, 176, 203, 0.3)";
        }}
        title={fullName}
      >
        {initials}
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          className="theme-tropical"
          style={{
            position: "fixed",
            top: 76,
            left: 20,
            width: 240,
            background: "var(--color-surface, #FFFFFF)",
            color: "var(--color-text-main, #10131A)",
            border: "1px solid var(--color-border-light, #E1E5EC)",
            borderRadius: "16px",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.15)",
            zIndex: 1100,
            overflow: "hidden"
          }}
        >
          <div style={{ 
            padding: "16px", 
            borderBottom: "1px solid var(--color-border-light, #E1E5EC)",
            background: "var(--color-primary-ultra-soft, #F0FDFF)",
          }}>
            <div style={{ 
              fontWeight: 600, 
              fontSize: "15px",
              color: "var(--color-text-main, #10131A)",
              marginBottom: "4px",
            }}>
              {fullName}
            </div>
            <div style={{ 
              fontSize: "12px", 
              color: "var(--color-text-secondary, #6B7280)",
            }}>
              תפקיד: {role === "admin" ? "מנהל מערכת" : role === "event_manager" ? "מנהל אירוע" : "צופה"}
            </div>
          </div>
          {role === "admin" && (
            <button
              onClick={() => { setShowManagement(true); setMenuOpen(false); }}
              className="tropical-button-ghost"
              style={{ 
                width: "100%", 
                textAlign: "right", 
                padding: "12px 16px", 
                borderRadius: 0,
                justifyContent: "flex-end",
              }}
            >
              ניהול משתמשים
            </button>
          )}
        </div>
      )}

      {/* Modal for user management */}
      {showManagement && (
        <div
          onClick={() => setShowManagement(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="theme-tropical"
            style={{
              width: "min(1100px, 96%)",
              maxHeight: "90vh",
              background: "var(--color-surface, #FFFFFF)",
              color: "var(--color-text-main, #10131A)",
              borderRadius: "24px",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.2)",
              padding: "24px",
              overflow: "auto"
            }}
          >
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              marginBottom: "16px",
              paddingBottom: "16px",
              borderBottom: "1px solid var(--color-border-light, #E1E5EC)",
            }}>
              <h3 className="tropical-section-title" style={{ margin: 0, fontSize: "1.5rem" }}>ניהול משתמשים</h3>
              <button 
                onClick={() => setShowManagement(false)} 
                className="tropical-button-ghost"
                style={{ 
                  padding: "8px",
                  minWidth: "auto",
                  fontSize: "20px",
                  width: "36px",
                  height: "36px",
                }}
                title="סגור"
              >
                ✕
              </button>
            </div>
            <UserManagement eventId={eventId} />
          </div>
        </div>
      )}
    </div>
  );
}


