import React, { useState, useEffect } from 'react';
import RealTimeNotifications from './RealTimeNotifications';
import QRCodeScanner from './QRCodeScanner';
import RealTimeSeatingMap from './RealTimeSeatingMap';
import './RealTimeDashboard.css';
import '../styles/theme-tropical.css';

const RealTimeDashboard = ({ eventId }) => {
  const [tables, setTables] = useState([]);
  const [seatings, setSeatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('scanner');
  const [activeHallTab, setActiveHallTab] = useState('m'); // הוסף בחירת מגדר
  const [ws, setWs] = useState(null);
  const [eventName, setEventName] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);

  // פתיחה אוטומטית כשיש התראות, סגירה כשאין
  useEffect(() => {
    if (notificationsCount > 0) {
      setNotificationsOpen(true);
    } else if (notificationsCount === 0) {
      setNotificationsOpen(false);
    }
  }, [notificationsCount]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      
      const [tablesResponse, seatingsResponse, eventResponse] = await Promise.all([
        fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`http://localhost:8001/seatings/event/${eventId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`http://localhost:8001/events/${eventId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        })
      ]);

      const tablesData = await tablesResponse.json();
      const seatingsData = await seatingsResponse.json();
      
      // Try to get event name
      try {
        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          if (eventData && eventData.name) {
            setEventName(eventData.name);
          }
        } else {
          // If event not found, keep default fallback
          setEventName('');
        }
      } catch (error) {
        console.error('Error loading event name:', error);
        // Keep default fallback
        setEventName('');
      }

      // וודא שהנתונים הם מערכים
      const tablesArray = Array.isArray(tablesData) ? tablesData : [];
      const seatingsArray = Array.isArray(seatingsData) ? seatingsData : [];

      console.log('Tables data:', tablesArray);
      console.log('Seatings data:', seatingsArray);
      console.log('Tables count:', tablesArray.length);
      console.log('Seatings count:', seatingsArray.length);
      console.log('Event ID:', eventId);
      console.log('Hall type:', activeHallTab);
      
      // Debug each table from RealTimeDashboard
      tablesArray.forEach((table, index) => {
        console.log(`RealTimeDashboard Table ${index + 1}:`, {
          id: table.id,
          table_number: table.table_number,
          size: table.size,
          shape: table.shape,
          hall_type: table.hall_type,
          x: table.x,
          y: table.y,
          category: table.category
        });
      });

      // Debug: Log gender statistics
      const maleSeatings = seatingsArray.filter(s => s.guest_gender === 'male');
      const femaleSeatings = seatingsArray.filter(s => s.guest_gender === 'female');
      console.log('Male seatings:', maleSeatings.length);
      console.log('Female seatings:', femaleSeatings.length);
      console.log('All seatings with gender:', seatingsArray.map(s => ({ name: s.guest_name, gender: s.guest_gender })));
      
      // Debug: Check for null/undefined genders
      const nullGenders = seatingsArray.filter(s => !s.guest_gender);
      console.log('Seatings with null/undefined gender:', nullGenders.length);
      console.log('All gender values:', seatingsArray.map(s => s.guest_gender));
      
      // Debug: Log each seating object
      console.log('Full seatings data:', seatingsArray);
      
      // Debug: Log the first seating object in detail
      if (seatingsArray.length > 0) {
        console.log('First seating object keys:', Object.keys(seatingsArray[0]));
        console.log('First seating object:', JSON.stringify(seatingsArray[0], null, 2));
      }

      // Debug: Log all seating objects
      console.log('All seating objects:');
      seatingsArray.forEach((seating, index) => {
        console.log(`Seating ${index + 1}:`, {
          id: seating.id,
          guest_id: seating.guest_id,
          guest_name: seating.guest_name,
          guest_gender: seating.guest_gender,
          table_id: seating.table_id,
          table_number: seating.table_number,
          is_occupied: seating.is_occupied,
          occupied_at: seating.occupied_at,
          occupied_by: seating.occupied_by
        });
      });

      setTables(tablesArray);
      setSeatings(seatingsArray);
    } catch (error) {
      console.error('Error loading data:', error);
      setTables([]);
      setSeatings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId, activeHallTab]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const websocket = new WebSocket(`ws://localhost:8001/realtime/ws/${eventId}`);
    
    websocket.onopen = () => {
      console.log('WebSocket connected for dashboard');
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Dashboard received WebSocket message:', data);
      
      if (data.type === 'guest_arrived') {
        console.log('Guest arrived in dashboard:', data.guest);
        // טען מחדש את הנתונים מהשרת כדי לקבל את העדכונים האחרונים, ללא רענון עמוד
        loadData();
      } else if (data.type === 'table_full') {
        console.log('Table full notification in dashboard:', data);
        // אפשר להוסיף התראה מיוחדת לשולחן מלא
      }
    };
    
    websocket.onclose = () => {
      console.log('WebSocket disconnected for dashboard');
    };
    
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, [eventId]);

  const handleScanSuccess = (result) => {
    console.log('Scan successful:', result);
    // אפשר להוסיף לוגיקה נוספת כאן
  };

  const handleSeatingsUpdate = (updatedSeatings) => {
    setSeatings(updatedSeatings);
  };

  const handleUpdateGuestsGender = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8001/guests/update-gender-defaults/${eventId}`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`עודכנו ${result.updated_count} מוזמנים עם מגדר ברירת מחדל`);
        // טען מחדש את הנתונים ללא רענון עמוד
        loadData();
      } else {
        alert('שגיאה בעדכון המוזמנים');
      }
    } catch (error) {
      console.error('Error updating guests:', error);
      alert('שגיאה בעדכון המוזמנים');
    }
  };

  const handleFixSeatingStatus = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8001/realtime/fix-seating-status/${eventId}`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`תוקנו ${result.fixed_count} מקומות ישיבה`);
        // טען מחדש את הנתונים
        loadData();
      } else {
        alert('שגיאה בתיקון מקומות ישיבה');
      }
    } catch (error) {
      console.error('Error fixing seating status:', error);
      alert('שגיאה בתיקון מקומות ישיבה');
    }
  };

  if (loading) {
    return (
      <div className="tropical-card" style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--color-bg, #F7FAFC)',
        borderRadius: 0
      }}>
        <div className="loading-spinner" style={{
          width: '60px',
          height: '60px',
          border: '4px solid var(--color-primary-soft, #E0F7FA)',
          borderTop: '4px solid var(--color-primary, #09b0cb)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }}></div>
        <div className="tropical-section-title" style={{ marginBottom: 0 }}>טוען מערכת זמן אמת...</div>
      </div>
    );
  }

  return (
    <div className="realtime-dashboard" style={{ 
      minHeight: '100vh',
      background: 'var(--color-bg, #F7FAFC)',
    }}>
      {/* Header */}
      <div className="tropical-card" style={{ 
        borderRadius: 0,
        marginBottom: 0,
        background: 'transparent',
        color: 'var(--color-text-main, #10131A)',
        padding: '32px 0',
        borderBottom: 'none',
        boxShadow: 'none',
      }}>
        <div className="header-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h1 style={{ 
            textAlign: "center", 
            marginBottom: "12px", 
            color: "#09b0cb",
            fontSize: "32px",
            fontWeight: 700,
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            textShadow: "0 2px 4px rgba(9, 176, 203, 0.1)",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09b0cb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            מערכת זמן אמת - {eventName || `אירוע #${eventId}`}
          </h1>
          <div className="tropical-subtitle" style={{ 
            color: 'var(--color-text-secondary, #6B7280)', 
            marginBottom: '20px',
            fontSize: '16px',
            fontWeight: 500,
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}>
            ניהול כניסת מוזמנים והתראות בזמן אמת
          </div>
          
          {/* Hall Selection - Switcher מודרני */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '3px',
            background: 'rgba(242, 242, 247, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '999px',
            padding: '4px',
            border: 'none',
            marginTop: '16px',
            width: 'fit-content',
            position: 'relative',
            margin: '16px auto 0 auto'
          }}>
            <button 
              type="button"
              onClick={() => setActiveHallTab('m')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '140px',
                height: '42px',
                borderRadius: '999px',
                border: 'none',
                background: activeHallTab === 'm' 
                  ? '#09b0cb' 
                  : 'transparent',
                color: activeHallTab === 'm' 
                  ? '#ffffff' 
                  : 'rgba(142, 142, 147, 0.9)',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                WebkitTapHighlightColor: 'transparent',
                outline: 'none',
                position: 'relative',
                zIndex: activeHallTab === 'm' ? 2 : 1
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.97)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseEnter={(e) => {
                if (activeHallTab !== 'm') {
                  e.currentTarget.style.background = 'rgba(9, 176, 203, 0.15)';
                  e.currentTarget.style.color = 'rgba(9, 176, 203, 1)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeHallTab !== 'm') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(142, 142, 147, 0.9)';
                }
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              אולם גברים
            </button>
            <button 
              type="button"
              onClick={() => setActiveHallTab('w')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '140px',
                height: '42px',
                borderRadius: '999px',
                border: 'none',
                background: activeHallTab === 'w' 
                  ? '#09b0cb' 
                  : 'transparent',
                color: activeHallTab === 'w' 
                  ? '#ffffff' 
                  : 'rgba(142, 142, 147, 0.9)',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                WebkitTapHighlightColor: 'transparent',
                outline: 'none',
                position: 'relative',
                zIndex: activeHallTab === 'w' ? 2 : 1
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.97)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseEnter={(e) => {
                if (activeHallTab !== 'w') {
                  e.currentTarget.style.background = 'rgba(9, 176, 203, 0.15)';
                  e.currentTarget.style.color = 'rgba(9, 176, 203, 1)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeHallTab !== 'w') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(142, 142, 147, 0.9)';
                }
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              אולם נשים
            </button>
          </div>
        </div>
      </div>

      {/* Notifications Sidebar - Left */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: notificationsOpen ? '460px' : '60px',
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '2px 0 24px rgba(15, 23, 42, 0.15)',
        zIndex: 1000,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'row',
        borderRight: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: notificationsOpen ? '0' : '0 24px 24px 0',
        overflow: 'hidden'
      }}>
        {/* Toggle Tab - Part of Sidebar - Always Visible */}
        <div
          onClick={() => setNotificationsOpen(!notificationsOpen)}
          style={{
            width: '60px',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRight: notificationsOpen ? '1px solid rgba(148, 163, 184, 0.2)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: '20px',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <div style={{ position: 'relative' }}>
            {notificationsCount > 0 ? (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={notificationsCount > 0 ? '#09b0cb' : 'var(--color-text-main, #10131A)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer' }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {notificationsCount > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#EF4444',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    border: '2px solid white'
                  }}>
                    {notificationsCount > 99 ? '99+' : notificationsCount}
                  </div>
                )}
              </>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-main, #10131A)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" style={{ cursor: 'pointer' }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            )}
          </div>
        </div>
        
        {/* Content Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          width: notificationsOpen ? '400px' : '0',
          opacity: notificationsOpen ? 1 : 0,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
        <div style={{
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.98)'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--color-text-main, #10131A)',
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}>
            התראות {notificationsCount > 0 && `(${notificationsCount})`}
          </h3>
          <button
            onClick={() => setNotificationsOpen(false)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '12px',
              border: 'none',
              background: 'rgba(142, 142, 147, 0.15)',
              color: 'var(--color-text-main, #10131A)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(142, 142, 147, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(142, 142, 147, 0.15)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          padding: '0 20px 20px 20px',
          background: 'rgba(255, 255, 255, 0.98)'
        }}>
          <RealTimeNotifications 
            eventId={eventId} 
            onNotificationsChange={setNotificationsCount}
          />
        </div>
        </div>
      </div>

      {/* Navigation Tabs - Switcher מודרני */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '3px',
        background: 'rgba(242, 242, 247, 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '999px',
        padding: '4px',
        border: 'none',
        justifyContent: 'center', 
        padding: '8px',
        margin: '0 auto',
        width: 'fit-content',
        marginTop: '16px',
        marginBottom: '16px'
      }}>
        <button 
          type="button"
          onClick={() => setActiveTab('scanner')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            minWidth: '140px',
            height: '42px',
            borderRadius: '999px',
            border: 'none',
            background: activeTab === 'scanner' 
              ? '#09b0cb' 
              : 'transparent',
            color: activeTab === 'scanner' 
              ? '#ffffff' 
              : 'rgba(142, 142, 147, 0.9)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            WebkitTapHighlightColor: 'transparent',
            outline: 'none',
            position: 'relative',
            zIndex: activeTab === 'scanner' ? 2 : 1
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.97)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'scanner') {
              e.currentTarget.style.background = 'rgba(9, 176, 203, 0.15)';
              e.currentTarget.style.color = 'rgba(9, 176, 203, 1)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'scanner') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(142, 142, 147, 0.9)';
            }
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
            <path d="M7 7h10M7 12h10M7 17h10"></path>
          </svg>
          סריקת ברקוד
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('seating')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            minWidth: '140px',
            height: '42px',
            borderRadius: '999px',
            border: 'none',
            background: activeTab === 'seating' 
              ? '#09b0cb' 
              : 'transparent',
            color: activeTab === 'seating' 
              ? '#ffffff' 
              : 'rgba(142, 142, 147, 0.9)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            WebkitTapHighlightColor: 'transparent',
            outline: 'none',
            position: 'relative',
            zIndex: activeTab === 'seating' ? 2 : 1
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.97)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'seating') {
              e.currentTarget.style.background = 'rgba(9, 176, 203, 0.15)';
              e.currentTarget.style.color = 'rgba(9, 176, 203, 1)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'seating') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(142, 142, 147, 0.9)';
            }
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          מפת ישיבה
        </button>
        <button 
          type="button"
          onClick={() => setActiveTab('stats')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            minWidth: '140px',
            height: '42px',
            borderRadius: '999px',
            border: 'none',
            background: activeTab === 'stats' 
              ? '#09b0cb' 
              : 'transparent',
            color: activeTab === 'stats' 
              ? '#ffffff' 
              : 'rgba(142, 142, 147, 0.9)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            WebkitTapHighlightColor: 'transparent',
            outline: 'none',
            position: 'relative',
            zIndex: activeTab === 'stats' ? 2 : 1
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.97)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'stats') {
              e.currentTarget.style.background = 'rgba(9, 176, 203, 0.15)';
              e.currentTarget.style.color = 'rgba(9, 176, 203, 1)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'stats') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(142, 142, 147, 0.9)';
            }
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          סטטיסטיקות
        </button>
      </div>

      {/* Statistics Bar at Top */}
      <div className="top-statistics-bar" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        padding: '20px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '20px',
        border: '1px solid rgba(148, 163, 184, 0.2)',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
        margin: '16px auto',
        maxWidth: '1200px',
        position: 'sticky',
        top: '60px',
        zIndex: 40,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flex: 1 }}>
          <div className="stat-item-top" style={{ textAlign: 'center', flex: 1 }}>
            <div className="stat-value-top">{Array.isArray(seatings) ? seatings.filter(s => s.is_occupied).length : 0}/{Array.isArray(seatings) ? seatings.length : 0}</div>
            <div className="stat-label-top">נכנסו</div>
          </div>
          <div className="stat-item-top" style={{ textAlign: 'center', flex: 1 }}>
            <div className="stat-value-top male">
              {Array.isArray(seatings) 
                ? `${seatings.filter(s => s.guest_gender === 'male' && s.is_occupied).length}/${seatings.filter(s => s.guest_gender === 'male').length}`
                : '0/0'}
            </div>
            <div className="stat-label-top">גברים</div>
          </div>
          <div className="stat-item-top" style={{ textAlign: 'center', flex: 1 }}>
            <div className="stat-value-top female">
              {Array.isArray(seatings) 
                ? `${seatings.filter(s => s.guest_gender === 'female' && s.is_occupied).length}/${seatings.filter(s => s.guest_gender === 'female').length}`
                : '0/0'}
            </div>
            <div className="stat-label-top">נשים</div>
          </div>
          <div className="stat-item-top" style={{ textAlign: 'center', flex: 1 }}>
            <div className="stat-value-top">{Array.isArray(seatings) ? seatings.length - seatings.filter(s => s.is_occupied).length : 0}</div>
            <div className="stat-label-top">נותרו</div>
          </div>
          <div className="stat-item-top" style={{ textAlign: 'center', flex: 1 }}>
            <div className="stat-value-top">{Array.isArray(seatings) && seatings.length > 0 
              ? Math.round((seatings.filter(s => s.is_occupied).length / seatings.length) * 100)
              : 0}%</div>
            <div className="stat-label-top">תפוסה</div>
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px', 
          alignItems: 'flex-end',
          borderRight: '1px solid rgba(148, 163, 184, 0.2)',
          paddingRight: '20px',
          marginRight: '20px'
        }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600, 
            color: 'var(--color-text-secondary, #6B7280)',
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            marginBottom: '4px',
            textAlign: 'right',
            width: '100%'
          }}>
            פעולות נוספות
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={handleUpdateGuestsGender}
              className="tropical-button-primary"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                fontSize: '13px',
                padding: '8px 16px',
                width: 'auto',
                minWidth: '180px',
                borderRadius: '999px',
                fontWeight: 600,
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                border: 'none',
                color: 'white',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.25)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              עדכן מגדר
            </button>
            <button 
              onClick={handleFixSeatingStatus}
              className="tropical-button-primary"
              style={{
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                fontSize: '13px',
                padding: '8px 16px',
                width: 'auto',
                minWidth: '180px',
                borderRadius: '999px',
                fontWeight: 600,
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
                border: 'none',
                color: 'white',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.25)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="M9 12l2 2 4-4"></path>
              </svg>
              תקן סטטוס ישיבה
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Full Width */}
      <div className="dashboard-layout-full">
        {/* Main Content Area */}
        <div className="dashboard-content-full">
          {activeTab === 'scanner' && (
            <div className="tab-content">
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <QRCodeScanner 
                  eventId={eventId} 
                  onScan={handleScanSuccess}
                />
              </div>
            </div>
          )}

          {activeTab === 'seating' && (
            <div className="tab-content">
              <RealTimeSeatingMap 
                eventId={eventId}
                tables={tables}
                seatings={seatings}
                onSeatingsUpdate={handleSeatingsUpdate}
                activeHallTab={activeHallTab}
              />
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="tab-content" style={{ padding: '24px' }}>
              <div className="stats-dashboard" style={{
                background: 'var(--color-surface, #FFFFFF)',
                borderRadius: '20px',
                padding: '24px',
                border: '1px solid var(--color-border-light, #E1E5EC)',
              }}>
                <div className="stats-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '20px',
                }}>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ 
                      width: 48,
                      height: 48,
                      margin: '0 auto 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(9, 176, 203, 0.1)',
                      borderRadius: '16px'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#09b0cb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">
                        {Array.isArray(seatings) ? seatings.filter(s => s.is_occupied).length : 0}
                      </div>
                      <div className="stat-label">מוזמנים שנכנסו</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ 
                      width: 48,
                      height: 48,
                      margin: '0 auto 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(9, 176, 203, 0.1)',
                      borderRadius: '16px'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#09b0cb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">
                        {Array.isArray(seatings) ? seatings.filter(s => s.guest_id && !s.is_occupied).length : 0}
                      </div>
                      <div className="stat-label">מוקצים</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ 
                      width: 48,
                      height: 48,
                      margin: '0 auto 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(9, 176, 203, 0.1)',
                      borderRadius: '16px'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#09b0cb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">
                        {Array.isArray(seatings) ? seatings.filter(s => !s.guest_id).length : 0}
                      </div>
                      <div className="stat-label">מקומות פנויים</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ 
                      width: 48,
                      height: 48,
                      margin: '0 auto 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(9, 176, 203, 0.1)',
                      borderRadius: '16px'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#09b0cb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">
                        {Array.isArray(seatings) && seatings.length > 0 
                          ? Math.round((seatings.filter(s => s.is_occupied).length / seatings.length) * 100)
                          : 0}%
                      </div>
                      <div className="stat-label">אחוז נוכחות</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default RealTimeDashboard; 