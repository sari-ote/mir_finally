import React, { useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import UserIcon from "./ui/UserIcon";
import UserManagement from "./EventTabs/UserManagement";
import "../styles/theme-tropical.css";

export default function TopActionButtons() {
  const location = useLocation();
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

  // Don't show on login or public pages
  if (location.pathname === "/" || 
      location.pathname === "/login" || 
      location.pathname.startsWith("/public")) {
    return null;
  }

  // Extract eventId from URL
  const eventIdMatch = location.pathname.match(/\/events\/(\d+)/);
  const eventId = eventIdMatch ? parseInt(eventIdMatch[1]) : null;
  
  // Hide profile button on event pages (it's now part of the sidebar)
  const isEventPage = location.pathname.startsWith("/events/");

  return (
    <>
      {/* Profile Button - Only show on non-event pages */}
      {!isEventPage && (
      <div dir="rtl" style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 1001,
      }}>
        <div style={{ position: "relative" }}>
          <button
          aria-label="פרופיל משתמש"
          onClick={() => setMenuOpen(v => !v)}
          className="theme-tropical"
          style={{
            background: "rgba(9, 176, 203, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            width: 52,
            height: 52,
            borderRadius: "50%",
            color: "white",
            border: "1px solid rgba(6, 122, 138, 0.3)",
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(9, 176, 203, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)",
            fontWeight: 600,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            padding: 0,
            margin: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.08) translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 12px 32px rgba(9, 176, 203, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15)";
            e.currentTarget.style.background = "rgba(9, 176, 203, 1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1) translateY(0)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(9, 176, 203, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)";
            e.currentTarget.style.background = "rgba(9, 176, 203, 0.95)";
          }}
          title={fullName}
        >
          {initials ? (
            <span style={{ fontSize: "18px", fontWeight: 600 }}>{initials}</span>
          ) : (
            <UserIcon size={22} color="white" />
          )}
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "transparent",
                zIndex: 1000,
                cursor: "pointer"
              }}
            />
            <div
              className="theme-tropical"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: 64,
                right: 0,
                width: 260,
                background: "rgba(255, 255, 255, 0.98)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                color: "var(--color-text-main, #10131A)",
                border: "1px solid rgba(225, 229, 236, 0.8)",
                borderRadius: "20px",
                boxShadow: "0 12px 40px rgba(15, 23, 42, 0.2), 0 4px 16px rgba(0, 0, 0, 0.1)",
                zIndex: 1001,
                overflow: "hidden",
                cursor: "default"
              }}
            >
            <div style={{ 
              padding: "16px", 
              borderBottom: "1px solid rgba(225, 229, 236, 0.8)",
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
            {role === "admin" && eventId && (
              <div style={{ 
                padding: "16px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}>
                <button
                  onClick={() => { setShowManagement(true); setMenuOpen(false); }}
                  className="tropical-button-primary"
                  style={{ 
                    width: "auto",
                    minWidth: "200px",
                    padding: "12px 24px",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                  }}
                >
                  לניהול משתמשים
                </button>
              </div>
            )}
            </div>
          </>
        )}
        </div>
      </div>
      )}

      {/* Modal for user management */}
      {showManagement && eventId && (
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
            dir="rtl"
            style={{
              width: "min(1100px, 96%)",
              maxHeight: "90vh",
              background: "var(--color-surface, #FFFFFF)",
              color: "var(--color-text-main, #10131A)",
              borderRadius: "24px",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.2)",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}
          >
            {/* Header - Fixed */}
            <div style={{ 
              direction: "rtl",
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              padding: "24px",
              paddingBottom: "16px",
              borderBottom: "1px solid var(--color-border-light, #E1E5EC)",
              flexShrink: 0
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
            {/* Content - Scrollable */}
            <div style={{ 
              direction: "ltr", // LTR for scrollbar positioning (right side)
              overflow: "auto",
              flex: 1,
              padding: "24px",
              paddingRight: "36px", // Extra space for scrollbar on right (32px + 4px)
              paddingTop: "20px", // 16px + 4px
              paddingBottom: "28px", // 24px + 4px
              minHeight: 0,
              scrollbarGutter: "stable"
            }}>
              <div style={{ direction: "rtl" }}>
                <UserManagement eventId={eventId} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

