import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import InviteFormTab from "./InviteFormTab.jsx";
import GuestList from "./GuestsList";
import EventSettingsTab from "./EventSettingsTab";
import SeatingArrangementTab from "./SeatingArrangementTab";
import TicketsTab from "./TicketsTab"; 
import RealTimeDashboard from "../RealTimeDashboard";
import TropicalWrapper from "../TropicalWrapper";
import { FormIcon, SettingsIcon, GuestsIcon, SeatingIcon, TicketsIcon, RealtimeIcon } from "../ui/SidebarIcons";
import UserIcon from "../ui/UserIcon";
import HistoryIcon from "../ui/HistoryIcon";
import UserManagement from "./UserManagement";
import AuditLog from "../AuditLog";
import "../../styles/theme-tropical.css";

export default function EventPage() {
  const { eventId } = useParams();
  console.log('EventPage: eventId from useParams:', eventId);
  const [activeTab, setActiveTab] = useState("form");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const role = localStorage.getItem("role");
  const token = localStorage.getItem("access_token");
  
  const username = localStorage.getItem("username") || "משתמש";
  const fullName = localStorage.getItem("full_name") || username;

  // Debug imported component types
  console.log('Component types:\n', {
    InviteFormTab: typeof InviteFormTab,
    InviteFormTab_default: typeof (InviteFormTab && InviteFormTab.default),
    EventSettingsTab: typeof EventSettingsTab,
    GuestList: typeof GuestList,
    UserManagement: typeof UserManagement,
    SeatingArrangementTab: typeof SeatingArrangementTab,
    TicketsTab: typeof TicketsTab,
    RealTimeDashboard: typeof RealTimeDashboard,
  });

  const renderTabContent = () => {
    console.log('EventPage: renderTabContent called with activeTab:', activeTab);
    switch (activeTab) {
      case "form": {
        const ResolvedInviteForm =
          typeof InviteFormTab === 'function'
            ? InviteFormTab
            : (InviteFormTab && typeof InviteFormTab.default === 'function'
                ? InviteFormTab.default
                : null);
        if (!ResolvedInviteForm) {
          console.error('InviteFormTab is not a valid component. Got:', InviteFormTab);
          return null;
        }
        return <ResolvedInviteForm eventId={eventId} />;
      }
      case "settings":
        console.log('EventPage: rendering EventSettingsTab with eventId:', eventId);
        return <EventSettingsTab eventId={eventId} />;
      case "guests":
        return <GuestList eventId={eventId} />;
      case "seating":
        return <SeatingArrangementTab eventId={eventId} />;
      case "tickets":
        return <TicketsTab eventId={eventId} />;
      case "realtime":
        return <RealTimeDashboard eventId={eventId} />;
      default:
        return null;
    }
  };

  return (
    <TropicalWrapper>
      <div 
        className="page-shell" 
        onClick={() => {
          setMenuOpen(false);
          setShowAuditLog(false);
        }}
        style={{ 
          padding: activeTab === "realtime" ? "0" : "0", 
          direction: "rtl", 
          minHeight: "100vh",
          display: "flex",
        }}
      >
        {/* Sidebar Navigation - iOS Style */}
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "260px",
            background: "transparent",
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
            border: "none",
            boxShadow: "none",
            padding: "24px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
            overflowX: "hidden",
            alignItems: "stretch",
            borderTopLeftRadius: "0",
            borderBottomLeftRadius: "0",
          }}
        >
          {/* User Profile Button - Part of Navigation */}
          <div style={{ position: "relative", width: "100%", marginBottom: "12px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "8px" }}>
            <button
              aria-label="פרופיל משתמש"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="theme-tropical"
              style={{
                background: "transparent",
                backdropFilter: "blur(30px)",
                WebkitBackdropFilter: "blur(30px)",
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                color: "rgba(8, 200, 230, 0.95)",
                border: "2px solid rgba(8, 200, 230, 0.95)",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(8, 200, 230, 0.15)",
                fontWeight: 600,
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                margin: 0,
                fontSize: "15px",
                overflow: "visible",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(8, 200, 230, 0.25)";
                e.currentTarget.style.borderColor = "rgba(8, 200, 230, 1)";
                e.currentTarget.style.color = "rgba(8, 200, 230, 1)";
                e.currentTarget.style.background = "rgba(8, 200, 230, 0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(8, 200, 230, 0.15)";
                e.currentTarget.style.borderColor = "rgba(8, 200, 230, 0.95)";
                e.currentTarget.style.color = "rgba(8, 200, 230, 0.95)";
                e.currentTarget.style.background = "transparent";
              }}
              title={fullName}
            >
              <UserIcon size={28} color="currentColor" style={{ flexShrink: 0 }} />
            </button>
            <span style={{ 
              fontSize: "13px", 
              fontWeight: 600, 
              color: "rgba(8, 200, 230, 0.95)",
              textAlign: "center",
              letterSpacing: "-0.2px"
            }}>
              מנהל מערכת
            </span>
          </div>

          {[
            { id: "form", label: "טופס הזמנה", icon: FormIcon },
            { id: "settings", label: "הגדרות האירוע", icon: SettingsIcon },
            { id: "guests", label: "רשימת מוזמנים", icon: GuestsIcon },
            { id: "seating", label: "סידור מקומות ישיבה", icon: SeatingIcon },
            { id: "tickets", label: "כרטיסים", icon: TicketsIcon },
            { id: "realtime", label: "זמן אמת", icon: RealtimeIcon },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  fontSize: '15px',
                  padding: '14px 18px',
                  fontWeight: isActive ? 600 : 500,
                  borderRadius: "0",
                  borderTopRightRadius: "0",
                  borderBottomRightRadius: "0",
                  borderTopLeftRadius: "999px",
                  borderBottomLeftRadius: "999px",
                  border: "none",
                  textAlign: "right",
                  width: "100%",
                  background: isActive
                    ? "rgba(8, 200, 230, 0.95)"
                    : "transparent",
                  color: isActive
                    ? "white"
                    : "var(--color-text-main, #10131A)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  cursor: "pointer",
                  boxShadow: isActive
                    ? "0 4px 12px rgba(8, 200, 230, 0.3), 0 2px 4px rgba(8, 200, 230, 0.2)"
                    : "none",
                  transform: isActive ? "translateX(-4px)" : "translateX(0)",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: "10px",
                  direction: "rtl",
                  margin: 0,
                  boxSizing: "border-box",
                  minWidth: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(8, 200, 230, 0.1)";
                    e.currentTarget.style.transform = "translateX(-2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "translateX(0)";
                  }
                }}
              >
                {isActive && (
                  <div style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: "3px",
                    background: "rgba(255, 255, 255, 0.6)",
                    borderRadius: "0 14px 14px 0",
                  }} />
                )}
                <IconComponent size={20} color={isActive ? "white" : "var(--color-text-main, #10131A)"} />
                <span style={{ textAlign: "right", flex: 1 }}>{tab.label}</span>
              </button>
            );
          })}

          {/* History Button - Part of Navigation */}
          {eventId && (
            <div style={{ position: "relative", width: "100%", marginTop: "4px" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAuditLog(!showAuditLog);
                }}
                className="theme-tropical"
                style={{
                  fontSize: '15px',
                  padding: '14px 18px',
                  fontWeight: showAuditLog ? 600 : 500,
                  borderRadius: "0",
                  borderTopRightRadius: "0",
                  borderBottomRightRadius: "0",
                  borderTopLeftRadius: "999px",
                  borderBottomLeftRadius: "999px",
                  border: "none",
                  textAlign: "right",
                  width: "100%",
                  background: showAuditLog
                    ? "rgba(8, 200, 230, 0.95)"
                    : "transparent",
                  color: showAuditLog
                    ? "white"
                    : "var(--color-text-main, #10131A)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  cursor: "pointer",
                  boxShadow: showAuditLog
                    ? "0 4px 12px rgba(8, 200, 230, 0.3), 0 2px 4px rgba(8, 200, 230, 0.2)"
                    : "none",
                  transform: showAuditLog ? "translateX(-4px)" : "translateX(0)",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: "10px",
                  direction: "rtl",
                }}
                onMouseEnter={(e) => {
                  if (!showAuditLog) {
                    e.currentTarget.style.background = "rgba(8, 200, 230, 0.1)";
                    e.currentTarget.style.transform = "translateX(-2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showAuditLog) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.transform = "translateX(0)";
                  }
                }}
                title="היסטוריית שינויים"
              >
                {showAuditLog && (
                  <div style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: "3px",
                    background: "rgba(255, 255, 255, 0.6)",
                    borderRadius: "0 14px 14px 0",
                  }} />
                )}
                <HistoryIcon size={20} color={showAuditLog ? "white" : "var(--color-text-main, #10131A)"} />
                <span style={{ textAlign: "right", flex: 1 }}>היסטוריית שינויים</span>
              </button>

            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div 
          className="page-shell__inner" 
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            padding: activeTab === "realtime" ? "0" : "30px",
            overflowY: "auto",
          }}
        >
          <div>{renderTabContent()}</div>
        </div>

        {/* User Profile Dropdown - Outside sidebar, positioned next to sidebar */}
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "transparent",
                zIndex: 9999,
                cursor: "pointer"
              }}
            />
            <div
              className="theme-tropical"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                top: "24px",
                right: "280px", // Next to sidebar (260px sidebar + 20px margin)
                width: "min(280px, calc(100vw - 300px))", // Ensure it doesn't go off screen
                minWidth: "240px",
                background: "rgba(255, 255, 255, 0.98)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                color: "var(--color-text-main, #10131A)",
                border: "1px solid rgba(225, 229, 236, 0.8)",
                borderRadius: "20px",
                boxShadow: "0 12px 40px rgba(15, 23, 42, 0.2), 0 4px 16px rgba(0, 0, 0, 0.1)",
                zIndex: 10000, // Very high z-index to ensure visibility
                overflow: "hidden",
                maxHeight: "calc(100vh - 48px)",
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

        {/* Audit Log Popup - Outside sidebar, positioned next to sidebar */}
        {showAuditLog && eventId && (
          <>
            <div 
              onClick={() => setShowAuditLog(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.3)",
                backdropFilter: "blur(2px)",
                zIndex: 9999,
                cursor: "pointer"
              }}
            />
            <div 
              className="theme-tropical tropical-modal-content"
              onClick={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                top: "24px",
                right: "280px", // Next to sidebar (260px sidebar + 20px margin)
                width: "min(380px, calc(100vw - 300px))", // Ensure it doesn't go off screen
                minWidth: "320px",
                maxHeight: "calc(100vh - 48px)",
                background: "rgba(255, 255, 255, 0.98)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: "20px",
                boxShadow: "0 12px 40px rgba(15, 23, 42, 0.2), 0 4px 16px rgba(0, 0, 0, 0.1)",
                border: "1px solid rgba(225, 229, 236, 0.8)",
                overflowY: "auto",
                zIndex: 10000, // Very high z-index to ensure visibility
                padding: "20px 36px 28px 24px",
                direction: "ltr",
                scrollbarGutter: "stable",
                cursor: "default"
              }}
            >
              <div style={{ direction: "rtl" }}>
                <AuditLog eventId={eventId} />
              </div>
            </div>
          </>
        )}
      </div>

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
            className="theme-tropical tropical-modal-content"
            style={{
              width: "min(1100px, 96%)",
              maxHeight: "90vh",
              background: "var(--color-surface, #FFFFFF)",
              color: "var(--color-text-main, #10131A)",
              borderRadius: "24px",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.2)",
              padding: "24px",
              overflow: "auto",
              direction: "ltr",
              scrollbarGutter: "stable"
            }}
          >
            <div style={{ 
              direction: "rtl",
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
            <div style={{ direction: "rtl", padding: "20px 36px 28px 24px" }}>
              <UserManagement eventId={eventId} />
            </div>
          </div>
        </div>
      )}
    </TropicalWrapper>
  );
}