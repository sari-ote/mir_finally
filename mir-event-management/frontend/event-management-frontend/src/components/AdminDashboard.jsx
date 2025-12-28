import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import backgroundImage from "../images/login.png";
import TropicalWrapper from "./TropicalWrapper";
import "../styles/theme-tropical.css";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 18) return "צהריים טובים";
  return "ערב טוב";
}

export default function AdminDashboard() {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("events"); // events
  const [newEvent, setNewEvent] = useState({
    name: "",
    type: "",
    date: "",
    location: "",
  });
  const [customFields, setCustomFields] = useState([]);

  const fullName = localStorage.getItem("full_name");
  const role = localStorage.getItem("role");
  const token = localStorage.getItem("access_token");
  const navigate = useNavigate();

  const isAdmin = role === "admin";

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch("http://localhost:8001/events", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setEvents(data);
      } catch (err) {
        console.error("שגיאה בטעינה:", err);
      }
    };
    fetchEvents();
  }, [token]);

  const isPast = (dateStr) => new Date(dateStr) < new Date();
  const handleEventClick = (id) => navigate(`/events/${id}`);

  const handleAddField = () => {
    setCustomFields([...customFields, { key: "", value: "" }]);
  };

  const handleFieldChange = (index, field, value) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields(updated);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('access_token');
      
      const response = await fetch("http://localhost:8001/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newEvent.name,
          type: newEvent.type,
          date: newEvent.date,
          location: newEvent.location,
          extra_fields: customFields.reduce((acc, field) => {
            if (field.key.trim()) acc[field.key] = field.value;
            return acc;
          }, {}),
        }),
      });
      const data = await response.json();
      setEvents([...events, data]);
      setShowForm(false);
      setNewEvent({ name: "", type: "", date: "", location: "" });
      setCustomFields([]);
    } catch (err) {
      console.error("שגיאה ביצירה:", err);
    }
  };

  return (
    <TropicalWrapper>
      <div className="page-shell" style={{ 
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '100vh',
      }}>
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(2px)',
          }}
        />
        <div className="page-shell__inner" style={{ position: 'relative', zIndex: 2 }}>
          <div className="tropical-section" style={{ marginBottom: '32px' }}>
            <h1 className="tropical-title-main" style={{ 
              color: 'var(--color-text-main, #10131A)', 
              marginBottom: '24px',
              fontSize: '32px',
              fontWeight: 700,
            }}>
              {getGreeting()} {fullName}
            </h1>
          </div>

      {/* תוכן טאב אירועים */}
      {activeTab === "events" && (
        <>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="tropical-button-primary"
              style={{ margin: "20px 0" }}
            >
              + הוסף אירוע חדש
            </button>
          )}

          {showForm && (
            <div className="tropical-card" style={{ marginBottom: "30px", padding: "24px" }}>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <input
                  type="text"
                  placeholder="שם האירוע"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  required
                  className="tropical-input"
                />
                <input
                  type="text"
                  placeholder="סוג"
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                  required
                  className="tropical-input"
                />
                
                <input
                  type="datetime-local"
                  placeholder="תאריך ושעה"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  required
                  className="tropical-input"
                />
                
                <input
                  type="text"
                  placeholder="מיקום"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  required
                  className="tropical-input"
                />

                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ color: 'var(--color-text-main)', marginBottom: '12px' }}>שדות נוספים:</h4>
                  {customFields.map((field, index) => (
                    <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <input
                        placeholder="שם שדה"
                        value={field.key}
                        onChange={(e) => handleFieldChange(index, "key", e.target.value)}
                        className="tropical-input"
                        style={{ flex: 1 }}
                      />
                      <input
                        placeholder="ערך"
                        value={field.value}
                        onChange={(e) => handleFieldChange(index, "value", e.target.value)}
                        className="tropical-input"
                        style={{ flex: 1 }}
                      />
                    </div>
                  ))}
                </div>
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="tropical-button-secondary"
                    style={{ flex: 1 }}
                  >
                    + הוסף שדה נוסף
                  </button>
                  <button type="submit" className="tropical-button-primary" style={{ flex: 1 }}>שמור</button>
                </div>
              </form>
            </div>
          )}

          <h2 className="tropical-section-title" style={{ color: 'white', marginBottom: '24px' }}>
            האירועים שלך:
          </h2>
          {events.length > 0 ? (
            <div className="tropical-grid">
              {events.map((event) => (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event.id)}
                  className="tropical-card"
                  style={{ 
                    cursor: 'pointer',
                    opacity: isPast(event.date) ? 0.7 : 1,
                  }}
                >
                  <div className="tropical-card__body">
                    <h3 style={{ 
                      color: 'var(--color-text-main)', 
                      marginBottom: '12px',
                      fontSize: '1.25rem',
                      fontWeight: 600,
                    }}>
                      {event.name}
                    </h3>
                    <div style={{ 
                      color: 'var(--color-text-secondary)', 
                      marginBottom: '8px',
                      fontSize: '0.95rem',
                    }}>
                      {new Date(event.date).toLocaleDateString('he-IL')}
                    </div>
                    <div style={{ 
                      fontSize: "0.85rem", 
                      color: "var(--color-text-tertiary)",
                      marginBottom: '8px',
                    }}>
                      {new Date(event.date).toLocaleString()}
                    </div>
                    {isPast(event.date) && (
                      <span className="tropical-badge tropical-badge-error" style={{ marginTop: '8px' }}>
                        אירוע חלף
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="tropical-card" style={{ 
              padding: '48px 24px', 
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📅</div>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: 600, 
                color: 'var(--color-text-main)',
                marginBottom: '8px',
              }}>
                אין אירועים עדיין
              </div>
              <div style={{ 
                color: 'var(--color-text-secondary)',
                fontSize: '0.95rem',
              }}>
                צור את האירוע הראשון שלך
              </div>
            </div>
          )}
        </>
      )}
        </div>
      </div>
    </TropicalWrapper>
  );
}
