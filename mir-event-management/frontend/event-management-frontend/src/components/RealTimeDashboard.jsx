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
        background: 'var(--color-surface, #FFFFFF)',
        color: 'var(--color-text-main, #10131A)',
        padding: '24px 0',
        borderBottom: '2px solid var(--color-border-light, #E1E5EC)',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
      }}>
        <div className="header-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h1 className="tropical-title-main" style={{ 
            color: 'var(--color-text-main, #10131A)', 
            marginBottom: '8px', 
            fontSize: '32px',
            fontWeight: 700,
          }}>
            <span style={{ marginLeft: '10px', fontSize: '28px' }}>⚡</span>
            מערכת זמן אמת - {eventName || `אירוע #${eventId}`}
          </h1>
          <div className="tropical-subtitle" style={{ 
            color: 'var(--color-text-secondary, #6B7280)', 
            marginBottom: '16px',
            fontSize: '16px',
            fontWeight: 500,
          }}>
            ניהול כניסת מוזמנים והתראות בזמן אמת
          </div>
          
          {/* Hall Selection */}
          <div className="tropical-filters" style={{ 
            marginTop: '16px',
            justifyContent: 'center',
            gap: '10px',
          }}>
            <button 
              onClick={() => setActiveHallTab('m')}
              className={`tropical-pill-filter ${activeHallTab === 'm' ? 'tropical-pill-filter--active' : ''}`}
              style={{
                fontSize: '15px',
                padding: '12px 24px',
                fontWeight: 600,
              }}
            >
              👨 אולם גברים
            </button>
            <button 
              onClick={() => setActiveHallTab('w')}
              className={`tropical-pill-filter ${activeHallTab === 'w' ? 'tropical-pill-filter--active' : ''}`}
              style={{
                fontSize: '15px',
                padding: '12px 24px',
                fontWeight: 600,
              }}
            >
              👩 אולם נשים
            </button>
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            justifyContent: 'center', 
            flexWrap: 'wrap', 
            marginTop: '16px' 
          }}>
            <button 
              onClick={handleUpdateGuestsGender}
              className="tropical-button-primary"
              style={{
                background: 'var(--color-success, #22C55E)',
                fontSize: '15px',
                padding: '12px 24px',
                width: 'auto',
                minWidth: '240px',
                borderRadius: '999px',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.25)',
                border: 'none',
                color: 'white',
              }}
            >
              🔄 עדכן מגדר למוזמנים קיימים
            </button>
            <button 
              onClick={handleFixSeatingStatus}
              className="tropical-button-primary"
              style={{
                background: 'var(--color-warning, #F59E0B)',
                fontSize: '15px',
                padding: '12px 24px',
                width: 'auto',
                minWidth: '240px',
                borderRadius: '999px',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
                border: 'none',
                color: 'white',
              }}
            >
              🔧 תקן סטטוס מקומות ישיבה
            </button>
          </div>
        </div>
      </div>

      {/* Notifications on Right Top */}
      <div className="notifications-right-top">
        <RealTimeNotifications eventId={eventId} />
      </div>

      {/* Navigation Tabs */}
      <div className="tropical-filters" style={{ 
        justifyContent: 'center', 
        padding: '16px 24px',
        background: 'var(--color-surface, #FFFFFF)',
        margin: '0',
        borderBottom: '1px solid var(--color-border-light, #E1E5EC)',
        gap: '8px',
      }}>
        <button 
          className={`tropical-pill-filter ${activeTab === 'scanner' ? 'tropical-pill-filter--active' : ''}`}
          onClick={() => setActiveTab('scanner')}
          style={{
            fontSize: '15px',
            padding: '12px 24px',
            fontWeight: 600,
          }}
        >
          📱 סריקת ברקוד
        </button>
        <button 
          className={`tropical-pill-filter ${activeTab === 'seating' ? 'tropical-pill-filter--active' : ''}`}
          onClick={() => setActiveTab('seating')}
          style={{
            fontSize: '15px',
            padding: '12px 24px',
            fontWeight: 600,
          }}
        >
          🗺️ מפת ישיבה
        </button>
        <button 
          className={`tropical-pill-filter ${activeTab === 'stats' ? 'tropical-pill-filter--active' : ''}`}
          onClick={() => setActiveTab('stats')}
          style={{
            fontSize: '15px',
            padding: '12px 24px',
            fontWeight: 600,
          }}
        >
          📊 סטטיסטיקות
        </button>
      </div>

      {/* Statistics Bar at Top */}
      <div className="top-statistics-bar" style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        padding: '16px',
        background: 'var(--color-surface, #FFFFFF)',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.12)',
        margin: '16px auto',
        maxWidth: '800px',
        position: 'sticky',
        top: '60px',
        zIndex: 40,
      }}>
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

      {/* Main Content - Full Width */}
      <div className="dashboard-layout-full">
        {/* Main Content Area */}
        <div className="dashboard-content-full">
          {activeTab === 'scanner' && (
            <div className="tab-content">
              <QRCodeScanner 
                eventId={eventId} 
                onScan={handleScanSuccess}
              />
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
                    <div className="stat-icon" style={{ fontSize: '48px', marginBottom: '16px', textAlign: 'center' }}>👥</div>
                    <div className="stat-info">
                      <div className="stat-value">
                        {Array.isArray(seatings) ? seatings.filter(s => s.is_occupied).length : 0}
                      </div>
                      <div className="stat-label">מוזמנים שנכנסו</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ fontSize: '48px', marginBottom: '16px', textAlign: 'center' }}>📋</div>
                    <div className="stat-info">
                      <div className="stat-value">
                        {Array.isArray(seatings) ? seatings.filter(s => s.guest_id && !s.is_occupied).length : 0}
                      </div>
                      <div className="stat-label">מוקצים</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ fontSize: '48px', marginBottom: '16px', textAlign: 'center' }}>🪑</div>
                    <div className="stat-info">
                      <div className="stat-value">
                        {Array.isArray(seatings) ? seatings.filter(s => !s.guest_id).length : 0}
                      </div>
                      <div className="stat-label">מקומות פנויים</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon" style={{ fontSize: '48px', marginBottom: '16px', textAlign: 'center' }}>📊</div>
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