import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import backgroundImage from "../images/login.png";
import TropicalWrapper from "./TropicalWrapper";
import "../styles/theme-tropical.css";
import TrashIcon from "./ui/TrashIcon";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "בוקר טוב";
  if (hour < 18) return "צהריים טובים";
  return "ערב טוב";
}

export default function AdminDashboard() {
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(true);
  const [activeTab, setActiveTab] = useState("events"); // events
  const [newEvent, setNewEvent] = useState({
    name: "",
    type: "",
    date: "",
    location: "",
  });
  const [customFields, setCustomFields] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPastOnly, setShowPastOnly] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const fullName = localStorage.getItem("full_name");
  const role = localStorage.getItem("role");
  const token = localStorage.getItem("access_token");
  const navigate = useNavigate();

  const isAdmin = role === "admin";

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          console.error("אין טוקן - צריך להתחבר מחדש");
          return;
        }
        console.log("מנסה לטעון אירועים...");
        console.log("Token exists:", !!token);
        console.log("Token length:", token ? token.length : 0);
        const response = await fetch("http://localhost:8001/events", {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
        });
        console.log("תגובת שרת:", response.status, response.statusText);
        console.log("Response headers:", Object.fromEntries(response.headers.entries()));
        if (!response.ok) {
          console.error("שגיאה בטעינת אירועים:", response.status, response.statusText);
          const errorText = await response.text();
          console.error("תוכן שגיאה:", errorText);
          
          // If 401, clear token and redirect to login
          if (response.status === 401) {
            console.error("טוקן לא תקין - צריך להתחבר מחדש");
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_id');
            localStorage.removeItem('role');
            localStorage.removeItem('full_name');
            // Redirect to login after a short delay
            setTimeout(() => {
              window.location.href = '/login';
            }, 1000);
          }
          
          setEvents([]);
          return;
        }
        const data = await response.json();
        console.log("אירועים שנטענו:", data);
        console.log("מספר אירועים:", Array.isArray(data) ? data.length : 0);
        console.log("סוג הנתונים:", typeof data);
        console.log("האם מערך?", Array.isArray(data));
        if (Array.isArray(data) && data.length > 0) {
          console.log("אירוע ראשון:", data[0]);
        }
        const eventsArray = Array.isArray(data) ? data : [];
        console.log("מגדיר אירועים:", eventsArray.length);
        setEvents(eventsArray);
      } catch (err) {
        console.error("שגיאה בטעינה:", err);
        setEvents([]);
      }
    };
    fetchEvents();
  }, [token]);

  const isPast = (dateStr) => new Date(dateStr) < new Date();

  const filteredEvents = React.useMemo(() => {
    console.log("DEBUG: Filtering events, total:", events.length);
    const filtered = events.filter((event) => {
      const text = `${event.name || ""} ${event.location || ""}`.toLowerCase();
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = term === "" || text.includes(term);
      const eventDate = event.date ? new Date(event.date) : null;
      const matchesPast =
        !showPastOnly || (eventDate && isPast(event.date));

      let matchesStart = true;
      if (startDateFilter && eventDate) {
        const start = new Date(startDateFilter);
        matchesStart = eventDate >= start;
      }

      let matchesEnd = true;
      if (endDateFilter && eventDate) {
        const end = new Date(endDateFilter);
        matchesEnd = eventDate <= end;
      }

      const result = matchesSearch && matchesPast && matchesStart && matchesEnd;
      if (!result && events.length > 0) {
        console.log("DEBUG: Event filtered out:", event.name, {
          matchesSearch,
          matchesPast,
          matchesStart,
          matchesEnd,
          searchTerm,
          showPastOnly,
          startDateFilter,
          endDateFilter
        });
      }
      return result;
    });
    
    // Sort events: future events first (newest first), then past events (newest first)
    const now = new Date();
    const futureEvents = filtered.filter(event => {
      const eventDate = event.date ? new Date(event.date) : null;
      return eventDate && eventDate >= now;
    });
    const pastEvents = filtered.filter(event => {
      const eventDate = event.date ? new Date(event.date) : null;
      return !eventDate || eventDate < now;
    });
    
    // Sort future events: newest first (closest upcoming event first)
    futureEvents.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB; // Ascending: closest first
    });
    
    // Sort past events: newest first (most recently past first)
    pastEvents.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA; // Descending: most recent past first
    });
    
    // Combine: future events first, then past events
    const sorted = [...futureEvents, ...pastEvents];
    
    console.log("DEBUG: Filtered events count:", sorted.length);
    return sorted;
  }, [events, searchTerm, showPastOnly, startDateFilter, endDateFilter]);

  // Debug: log events and filtered events
  useEffect(() => {
    console.log("DEBUG: events state:", events);
    console.log("DEBUG: events length:", events.length);
    console.log("DEBUG: filteredEvents length:", filteredEvents.length);
    console.log("DEBUG: searchTerm:", searchTerm);
    console.log("DEBUG: showPastOnly:", showPastOnly);
    console.log("DEBUG: startDateFilter:", startDateFilter);
    console.log("DEBUG: endDateFilter:", endDateFilter);
  }, [events, filteredEvents, searchTerm, showPastOnly, startDateFilter, endDateFilter]);
  const handleEventClick = (id) => navigate(`/events/${id}`);

  const handleAddField = () => {
    setCustomFields([...customFields, { key: "", value: "" }]);
  };

  const handleFieldChange = (index, field, value) => {
    const updated = [...customFields];
    updated[index][field] = value;
    setCustomFields(updated);
  };

  const handleRemoveField = (index) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
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
        position: 'relative',
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
        width: '100%',
      }}>
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(51, 24, 8, 0.9)', // #331808 עם אטימות 90%
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
        <div className="page-shell__inner" style={{ position: 'relative', zIndex: 2 }}>
          <div className="tropical-section" style={{ marginBottom: '32px' }}>
            <h1 className="tropical-title-main" style={{ 
              color: 'var(--color-primary, #09b0cb)', 
              marginBottom: '24px',
              fontSize: '32px',
              fontWeight: 700,
            }}>
              {getGreeting()} {fullName}
            </h1>
          </div>

      {/* תוכן טאב אירועים */}
      {activeTab === "events" && (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* טופס הוספת אירוע - צד ימין */}
          {showForm && (
            <div
              style={{
                maxWidth: "420px",
                width: "100%",
                marginInlineStart: "auto",
              }}
            >
              <h2
                className="tropical-section-title"
                style={{ color: 'var(--color-primary, #09b0cb)', marginBottom: '4px' }}
              >
                הוסף אירוע חדש
              </h2>
              <p
                style={{
                  margin: 0,
                  marginBottom: '20px',
                  fontSize: '0.95rem',
                  color: '#ffffff',
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                }}
              >
                מלא את הטופס ליצירת אירוע חדש
              </p>
              <div
                className="tropical-card"
                style={{
                  marginBottom: "30px",
                  padding: "24px",
                  width: "100%",
                }}
              >
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
                    placeholder="תאריך האירוע"
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

                  {customFields.map((field, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '8px',
                        alignItems: 'center',
                      }}
                    >
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
                      <button
                        type="button"
                        onClick={() => handleRemoveField(index)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--color-error, #ef4444)',
                          padding: '6px',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                        aria-label="מחק שדה"
                        title="מחק שדה"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="tropical-button-secondary"
                    style={{ marginTop: '12px', width: '100%' }}
                  >
                    + הוסף שדה נוסף
                  </button>
                  
                  <button
                    type="submit"
                    className="tropical-button-primary"
                    style={{ marginTop: '16px', width: '100%' }}
                  >
                    צור אירוע חדש
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* רשימת אירועים - צד שמאל */}
          <div style={{ flex: 1, minWidth: '260px' }}>
            <div
              style={{
                marginBottom: '16px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 12,
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2
                  className="tropical-section-title"
                  style={{ color: 'var(--color-primary, #09b0cb)', margin: 0 }}
                >
                  האירועים שלך
                </h2>
                <span
                  style={{
                    fontSize: '15.2px',
                    color: '#ffffff',
                    fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  }}
                >
                  בחר אירוע כדי לראות יותר פרטים
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 999,
                    backgroundColor: 'rgba(9, 176, 203, 0.06)',
                    border: '1px solid rgba(9, 176, 203, 0.25)',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <input
                    type="text"
                    placeholder="חפש אירוע לפי שם או מיקום"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="tropical-input"
                    style={{
                      flex: 1,
                      minWidth: '180px',
                      border: '1px solid var(--color-primary, #09b0cb)',
                      height: 40,
                    }}
                  />
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      paddingInline: 8,
                      borderRadius: 999,
                      backgroundColor: 'rgba(248,250,252,0.95)',
                      height: 40,
                      boxSizing: 'border-box',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--color-text-secondary, #4b5563)',
                      }}
                    >
                      הצג לפי תאריך
                    </span>
                    <input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: '0.85rem',
                        fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        cursor: 'pointer',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--color-text-tertiary, #9CA3AF)',
                      }}
                    >
                      עד
                    </span>
                    <input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: '0.85rem',
                        fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                        cursor: 'pointer',
                      }}
                    />
                  </div>
                  <button
                  type="button"
                  onClick={() => setShowPastOnly((prev) => !prev)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: '1px solid var(--color-primary, #09b0cb)',
                    backgroundColor: showPastOnly
                      ? 'rgba(9, 176, 203, 0.08)'
                      : 'rgba(248,250,252,0.9)',
                    color: showPastOnly
                      ? 'var(--color-primary-dark, #067a8a)'
                      : 'var(--color-text-secondary, #4b5563)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    height: 40,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: showPastOnly
                        ? 'var(--color-primary, #09b0cb)'
                        : 'rgba(148,163,184,0.5)',
                      position: 'relative',
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: -2,
                        left: showPastOnly ? '10px' : '-2px',
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                        transition: 'left 0.2s ease',
                      }}
                    />
                  </span>
                  <span>הצג רק אירועים שחלפו</span>
                </button>
                </div>
              </div>
            </div>
            {filteredEvents.length > 0 || events.length > 0 ? (
              <div className="tropical-grid">
                {(filteredEvents.length > 0 ? filteredEvents : events).map((event) => {
                  const eventDateObj = event.date ? new Date(event.date) : null;
                  const dateLabel = eventDateObj
                    ? eventDateObj.toLocaleDateString('he-IL')
                    : '-';
                  const timeLabel = eventDateObj
                    ? eventDateObj.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                    : '-';

                  return (
                    <div
                      key={event.id}
                      onClick={() => handleEventClick(event.id)}
                      className="tropical-card tropical-card--event"
                      style={{ 
                        cursor: 'pointer',
                        opacity: isPast(event.date) ? 0.7 : 1,
                      }}
                    >
                      <div
                        className="tropical-card__body"
                        style={{ position: 'relative', paddingTop: '20px' }}
                      >
                        {isPast(event.date) && (
                          <span
                            className="tropical-badge tropical-badge-error"
                            style={{
                              position: 'absolute',
                              top: 8,
                              left: 16,
                              marginTop: 0,
                            }}
                          >
                            אירוע חלף
                          </span>
                        )}
                        <h3 style={{ 
                          color: '#ffffff', 
                          marginBottom: '8px',
                          fontSize: '1.1rem',
                          fontWeight: 700,
                        }}>
                          <span style={{ color: '#ffffff', fontWeight: 500 }}>
                            שם האירוע:
                          </span>{" "}
                          <span style={{ color: 'var(--color-primary, #09b0cb)' }}>
                            {event.name}
                          </span>
                        </h3>
                        <div style={{ 
                          color: '#ffffff', 
                          marginBottom: '4px',
                          fontSize: '0.9rem',
                        }}>
                          <span style={{ fontWeight: 500 }}>תאריך: </span>
                          {dateLabel}
                        </div>
                        <div style={{ 
                          fontSize: "0.85rem", 
                          color: "#ffffff",
                          marginBottom: '4px',
                        }}>
                          <span style={{ fontWeight: 500 }}>שעה: </span>
                          {timeLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="tropical-card" style={{ 
                padding: '32px 24px', 
                textAlign: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
              }}>
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
          </div>
        </div>
      )}
        </div>
      </div>
    </TropicalWrapper>
  );
}
