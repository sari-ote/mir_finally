import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import InviteFormTab from "./InviteFormTab.jsx";
import GuestList from "./GuestsList";
import EventSettingsTab from "./EventSettingsTab";
import SeatingArrangementTab from "./SeatingArrangementTab";
import TicketsTab from "./TicketsTab";
import BlessingsTab from "./BlessingsTab";
import RealTimeDashboard from "../RealTimeDashboard";
import UserProfilePanel from "../UserProfilePanel";
import TropicalWrapper from "../TropicalWrapper";
import "../../styles/theme-tropical.css";

export default function EventPage() {
  const { eventId } = useParams();
  console.log('EventPage: eventId from useParams:', eventId);
  const [activeTab, setActiveTab] = useState(() => {
    // שמור את הטאב האחרון כדי שלא יקפוץ לטאב אחר אחרי רענון/ייבוא
    const saved = localStorage.getItem("event_active_tab");
    return saved || "guests";
  });
  const role = localStorage.getItem("role");

  useEffect(() => {
    localStorage.setItem("event_active_tab", activeTab);
  }, [activeTab]);

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
      case "blessings":
        return <BlessingsTab eventId={eventId} />;
      case "realtime":
        return <RealTimeDashboard eventId={eventId} />;
      default:
        return null;
    }
  };

  return (
    <TropicalWrapper>
      <div className="page-shell" style={{ 
        padding: activeTab === "realtime" ? "0" : "30px", 
        direction: "rtl", 
        minHeight: "100vh",
      }}>
        <div className="page-shell__inner">
          <div className="tropical-filters" style={{ 
            marginBottom: "20px", 
            padding: "16px 24px",
            background: "var(--color-surface, #FFFFFF)",
            borderBottom: "2px solid var(--color-border-light, #E1E5EC)",
            borderRadius: "0",
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
            justifyContent: "center",
            gap: "10px",
          }}>
            <button 
              className={`tropical-pill-filter ${activeTab === "form" ? "tropical-pill-filter--active" : ""}`}
              onClick={() => setActiveTab("form")}
              style={{
                fontSize: '15px',
                padding: '12px 24px',
                fontWeight: 600,
              }}
            >
              טופס הזמנה
            </button>
            <button 
              className={`tropical-pill-filter ${activeTab === "settings" ? "tropical-pill-filter--active" : ""}`}
              onClick={() => setActiveTab("settings")}
              style={{
                fontSize: '15px',
                padding: '12px 24px',
                fontWeight: 600,
              }}
            >
              הגדרות האירוע
            </button>
            <button 
              className={`tropical-pill-filter ${activeTab === "guests" ? "tropical-pill-filter--active" : ""}`}
              onClick={() => setActiveTab("guests")}
              style={{
                fontSize: '15px',
                padding: '12px 24px',
                fontWeight: 600,
              }}
            >
              רשימת מוזמנים
            </button>
            <button 
              className={`tropical-pill-filter ${activeTab === "seating" ? "tropical-pill-filter--active" : ""}`}
              onClick={() => setActiveTab("seating")}
              style={{
                fontSize: '15px',
                padding: '12px 24px',
                fontWeight: 600,
              }}
            >
              סידור מקומות ישיבה
            </button>
            <button 
              className={`tropical-pill-filter ${activeTab === "tickets" ? "tropical-pill-filter--active" : ""}`}
              onClick={() => setActiveTab("tickets")}
              style={{
                fontSize: '15px',
                padding: '12px 24px',
                fontWeight: 600,
              }}
            >
              כרטיסים
            </button>
            <button 
              className={`tropical-pill-filter ${activeTab === "blessings" ? "tropical-pill-filter--active" : ""}`}
              onClick={() => setActiveTab("blessings")}
              style={{
                fontSize: '15px',
                padding: '12px 24px',
                fontWeight: 600,
              }}
            >
              ברכות
            </button>
            <button 
              className={`tropical-pill-filter ${activeTab === "realtime" ? "tropical-pill-filter--active" : ""}`}
              onClick={() => setActiveTab("realtime")}
              style={{
                fontSize: '15px',
                padding: '12px 24px',
                fontWeight: 600,
              }}
            >
              ⚡ זמן אמת
            </button>
          </div>
          <div>{renderTabContent()}</div>
          <UserProfilePanel eventId={eventId} />
        </div>
      </div>
    </TropicalWrapper>
  );
}