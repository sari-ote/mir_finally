import React, { useEffect, useState } from 'react';
import './RealTimeNotifications.css';
import '../styles/theme-tropical.css';

const RealTimeNotifications = ({ eventId, onNotificationsChange }) => {
  const [notifications, setNotifications] = useState([]);
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // עדכן את מספר ההתראות
  useEffect(() => {
    if (onNotificationsChange) {
      onNotificationsChange(notifications.length);
    }
  }, [notifications, onNotificationsChange]);

  useEffect(() => {
    // חיבור WebSocket
    const websocket = new WebSocket(`ws://localhost:8001/realtime/ws/${eventId}`);
    
    websocket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };
    
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, [eventId]);

  // טען התראות מתמשכות שלא נקראו מהשרת והצג אותן עד לסגירה ידנית
  useEffect(() => {
    let isCancelled = false;
    let intervalId;

    const loadUnread = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`http://localhost:8001/realtime/notifications/${eventId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isCancelled) return;

        // מיפוי התראות שרת: מתמשכות רק לסוגים מסוימים
        const mapped = (Array.isArray(data) ? data : []).map(n => {
          const isPersistent = (
            n.notification_type === 'guest_arrived_no_seat' ||
            n.notification_type === 'table_full' ||
            n.notification_type === 'table_overbooked'
          );
          const type = n.notification_type === 'guest_arrived_no_seat' ? 'warning'
                     : n.notification_type === 'table_full' ? 'warning'
                     : n.notification_type === 'table_overbooked' ? 'error'
                     : 'success';
          const title = n.notification_type === 'guest_arrived_no_seat' ? 'מוזמן ללא מקום ישיבה'
                     : n.notification_type === 'guest_arrived' ? 'מוזמן נכנס'
                     : 'התראה';
          return {
            id: `srv-${n.id}`,
            serverId: n.id,
            type,
            title,
            message: n.message,
            timestamp: new Date(n.created_at || Date.now()).toLocaleTimeString('he-IL'),
            persistent: isPersistent,
            autoDismissMs: isPersistent ? undefined : 3000
          };
        });

        // איחוד: אל תיצור כפולים לפי serverId
        setNotifications(prev => {
          const existingIds = new Set(prev.filter(x => x.serverId).map(x => x.serverId));
          const toAdd = mapped.filter(m => !existingIds.has(m.serverId));
          // קבע טיימר להסרת התראות שאינן מתמשכות + סימון נקרא
          toAdd.forEach(m => {
            if (m.autoDismissMs) {
              setTimeout(async () => {
                // סמן כנקרא בשרת
                try {
                  const token2 = localStorage.getItem('access_token');
                  await fetch(`http://localhost:8001/realtime/notifications/${m.serverId}/mark-read`, {
                    method: 'POST', headers: { 'Authorization': `Bearer ${token2}` }
                  });
                } catch {}
                setNotifications(curr => curr.filter(x => x.id !== m.id));
              }, m.autoDismissMs);
            }
          });
          return [...toAdd, ...prev];
        });
      } catch (e) {
        // ignore
      }
    };

    loadUnread();
    intervalId = setInterval(loadUnread, 5000);

    return () => { isCancelled = true; clearInterval(intervalId); };
  }, [eventId]);

  const handleWebSocketMessage = (data) => {
    console.log('Received WebSocket message:', data);
    
    if (data.type === 'guest_arrived') {
      showNotification(data);
    } else if (data.type === 'table_full') {
      showTableFullNotification(data);
    } else if (data.type === 'table_almost_full') {
      showTableAlmostFullNotification(data);
    } else if (data.type === 'table_overbooked') {
      showTableOverbookedNotification(data);
    }
  };

  const showNotification = (data) => {
    const hasSeating = data.guest.table_id !== null && data.guest.table_id !== undefined;
    const isNoSeat = !hasSeating;
    const notification = {
      id: Date.now(),
      type: isNoSeat ? 'warning' : 'success',
      title: isNoSeat ? 'מוזמן ללא מקום ישיבה' : 'מוזמן נכנס',
      message: isNoSeat
        ? `${data.guest.first_name} ${data.guest.last_name} נכנס ללא מקום`
        : `${data.guest.first_name} ${data.guest.last_name} נכנס לאירוע`,
      timestamp: new Date().toLocaleTimeString('he-IL'),
      guest: data.guest,
      hasSeating,
      gender: data.guest.gender || 'unknown',
      persistent: isNoSeat // ללא מקום ישיבה יישאר עד סגירה ידנית
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);

    // אם יש מקום ישיבה – סגור אוטומטית אחרי 3 שניות
    if (hasSeating) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 3000);
    }
  };

  const showTableFullNotification = (data) => {
    const notification = {
      id: Date.now(),
      type: 'warning',
      title: '🚨 שולחן מלא!',
      message: `שולחן ${data.table.table_number} מלא! ${data.guest.first_name} ${data.guest.last_name} נכנס לשולחן מלא`,
      timestamp: new Date().toLocaleTimeString('he-IL'),
      tableId: data.table.id,
      tableNumber: data.table.table_number,
      occupancyPercentage: data.table.occupancy_percentage,
      persistent: true // התראות על שולחן מלא נשארות עד סגירה ידנית
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    // אין setTimeout - ההתראה תישאר עד סגירה ידנית
  };

  const showTableAlmostFullNotification = (data) => {
    const notification = {
      id: Date.now(),
      type: 'info',
      title: 'שולחן כמעט מלא',
      message: `שולחן ${data.table.table_number} כמעט מלא (${data.table.occupancy_percentage.toFixed(1)}%) - ${data.guest.first_name} ${data.guest.last_name} נכנס`,
      timestamp: new Date().toLocaleTimeString('he-IL'),
      tableId: data.table.id,
      tableNumber: data.table.table_number,
      occupancyPercentage: data.table.occupancy_percentage,
      persistent: false // התראות על שולחן כמעט מלא נעלמות אחרי זמן
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    
    // התראה על שולחן כמעט מלא נעלמת אחרי 15 שניות
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 15000);
  };

  const showTableOverbookedNotification = (data) => {
    const notification = {
      id: Date.now(),
      type: 'error',
      title: 'שולחן מלא מדי!',
      message: `שולחן ${data.table.table_number} מלא מדי! (${data.table.occupancy_percentage.toFixed(1)}%) - ${data.guest.first_name} ${data.guest.last_name} נכנס לשולחן מלא מדי`,
      timestamp: new Date().toLocaleTimeString('he-IL'),
      tableId: data.table.id,
      tableNumber: data.table.table_number,
      occupancyPercentage: data.table.occupancy_percentage,
      persistent: true // התראות על שולחן מלא מדי נשארות עד סגירה ידנית
    };
    setNotifications(prev => [notification, ...prev.slice(0, 4)]);
    // אין setTimeout - ההתראה תישאר עד סגירה ידנית
  };

  const dismissNotification = async (notificationId) => {
    const n = notifications.find(x => x.id === notificationId);
    if (n && n.serverId) {
      try {
        const token = localStorage.getItem('access_token');
        await fetch(`http://localhost:8001/realtime/notifications/${n.serverId}/mark-read`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch {}
    }
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const getNotificationIcon = (notification) => {
    if (notification.type === 'warning') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      );
    }
    if (notification.type === 'info') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      );
    }
    if (notification.type === 'error') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F44336" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      );
    }
    if (notification.gender === 'male') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A90E2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      );
    } else if (notification.gender === 'female') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E91E63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      );
    }
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    );
  };

  const getNotificationColor = (notification) => {
    if (notification.type === 'warning') {
      return '#F44336'; // אדום להתראות אזהרה
    }
    if (notification.type === 'info') {
      return '#FF9800'; // כתום להתראות מידע
    }
    if (notification.type === 'error') {
      return '#F44336'; // אדום להתראות שגיאה
    }
    if (notification.gender === 'male') {
      return '#4A90E2'; // כחול לגברים
    } else if (notification.gender === 'female') {
      return '#E91E63'; // ורוד לנשים
    }
    return '#4CAF50'; // ירוק - ברירת מחדל
  };

  const getNotificationClass = (notification) => {
    if (notification.type === 'warning' && notification.persistent) {
      return 'notification-card warning table-full';
    }
    if (notification.type === 'info' && notification.occupancyPercentage >= 80) {
      return 'notification-card info table-almost-full';
    }
    if (notification.type === 'error' && notification.persistent) {
      return 'notification-card error table-overbooked';
    }
    return `notification-card ${notification.type}`;
  };

  return (
    <div className="realtime-notifications-container" style={{ background: 'transparent' }}>
      {/* Connection Status */}
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: 600,
        marginBottom: '16px',
        fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: 'transparent',
        borderRadius: '0',
        border: 'none',
        boxShadow: 'none'
      }}>
        <div className="status-dot" style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: isConnected ? 'var(--color-success, #22C55E)' : 'var(--color-error, #F97373)',
          boxShadow: isConnected 
            ? '0 0 0 0 rgba(34, 197, 94, 0.7)' 
            : '0 0 0 0 rgba(249, 115, 115, 0.7)',
          animation: 'pulse 2s infinite',
        }}></div>
        <span style={{ 
          color: isConnected ? 'var(--color-success, #22C55E)' : 'var(--color-error, #F97373)',
          fontWeight: 600,
        }}>
          {isConnected ? 'מחובר' : 'מנותק'}
        </span>
      </div>

      {/* Notifications */}
      <div className="notifications-wrapper">
        {notifications.map(notification => (
          <div 
            key={notification.id} 
            style={{
              background: 'transparent',
              borderRadius: '0',
              padding: '16px',
              marginBottom: '12px',
              border: 'none',
              borderBottom: `2px solid ${getNotificationColor(notification)}40`,
              boxShadow: 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(9, 176, 203, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Accent Bar */}
            <div style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '3px',
              background: getNotificationColor(notification),
              borderRadius: '0'
            }} />
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '16px',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                background: `${getNotificationColor(notification)}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {getNotificationIcon(notification)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  gap: '12px',
                  marginBottom: '6px'
                }}>
                  <div style={{ 
                    fontWeight: 700, 
                    fontSize: '15px',
                    color: 'var(--color-text-main, #10131A)',
                    fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  }}>
                    {notification.title}
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    color: 'var(--color-text-secondary, #6B7280)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  }}>
                    {notification.timestamp}
                  </div>
                </div>
                <div style={{ 
                  fontSize: '14px',
                  color: 'var(--color-text-secondary, #6B7280)',
                  lineHeight: '1.5',
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                }}>
                  {notification.message}
                </div>
              </div>
              {notification.persistent && (
                <button 
                  onClick={() => dismissNotification(notification.id)}
                  title="סגור התראה"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'rgba(142, 142, 147, 0.1)',
                    color: 'var(--color-text-secondary, #6B7280)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(142, 142, 147, 0.2)';
                    e.currentTarget.style.color = 'var(--color-text-main, #10131A)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(142, 142, 147, 0.1)';
                    e.currentTarget.style.color = 'var(--color-text-secondary, #6B7280)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
            </div>
            
            {notification.guest && (
              <div style={{ 
                background: 'rgba(9, 176, 203, 0.05)', 
                borderRadius: '14px', 
                padding: '12px 16px', 
                marginTop: '12px',
                border: '1px solid rgba(9, 176, 203, 0.1)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ 
                    fontWeight: 600, 
                    color: 'var(--color-text-main, #10131A)', 
                    fontSize: '14px',
                    fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  }}>
                    {notification.guest.first_name} {notification.guest.last_name}
                  </span>
                  {notification.hasSeating ? (
                    <span style={{ 
                      fontSize: '12px', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      padding: '6px 12px',
                      background: 'rgba(9, 176, 203, 0.1)',
                      color: '#09b0cb',
                      borderRadius: '999px',
                      fontWeight: 600,
                      fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      שולחן {notification.guest.table_id}
                    </span>
                  ) : (
                    <span style={{ 
                      fontSize: '12px', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      padding: '6px 12px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      color: '#F59E0B',
                      borderRadius: '999px',
                      fontWeight: 600,
                      fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                      ללא מקום ישיבה
                    </span>
                  )}
                </div>
              </div>
            )}

            {notification.tableNumber && (
              <div style={{ 
                background: 'rgba(245, 158, 11, 0.08)',
                borderRadius: '14px', 
                padding: '12px 16px', 
                marginTop: '12px',
                border: '1px solid rgba(245, 158, 11, 0.2)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  gap: '12px' 
                }}>
                  <span style={{ 
                    fontSize: '13px', 
                    color: '#F59E0B', 
                    fontWeight: 700,
                    fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  }}>
                    שולחן {notification.tableNumber}
                  </span>
                  <span style={{ 
                    fontSize: '12px', 
                    color: 'var(--color-text-secondary, #6B7280)', 
                    fontWeight: 600,
                    padding: '4px 10px',
                    background: 'rgba(255, 255, 255, 0.6)',
                    borderRadius: '999px',
                    fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  }}>
                    {notification.occupancyPercentage >= 100 ? 'מלא' : `${notification.occupancyPercentage.toFixed(1)}% תפוס`}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {notifications.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px', 
          color: 'var(--color-text-secondary, #6B7280)',
        }}>
          <div style={{ 
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: 0.5
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <div className="tropical-section-title" style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--color-text-main, #10131A)' }}>אין התראות חדשות</div>
          <div className="tropical-subtitle" style={{ opacity: 0.7 }}>התראות יופיעו כאן כשמוזמנים ייכנסו</div>
        </div>
      )}
    </div>
  );
};

export default RealTimeNotifications; 