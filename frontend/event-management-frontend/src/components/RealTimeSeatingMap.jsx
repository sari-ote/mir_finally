import React, { useState, useEffect, useRef } from 'react';
import TableVisual from './TableVisual';
import './RealTimeSeatingMap.css';
import '../styles/theme-tropical.css';

const RealTimeSeatingMap = ({ eventId, tables, seatings, onSeatingsUpdate, activeHallTab }) => {
  const [realTimeSeatings, setRealTimeSeatings] = useState(seatings);
  const [isConnected, setIsConnected] = useState(false);
  const [activeGuests, setActiveGuests] = useState(new Set());
  const [genderFilter, setGenderFilter] = useState(activeHallTab === 'm' ? 'male' : 'female'); // השתמש במגדר הנכון
  
  // עדכון genderFilter כשמשנים activeHallTab
  useEffect(() => {
    setGenderFilter(activeHallTab === 'm' ? 'male' : 'female');
    console.log('RealTimeSeatingMap: Updated genderFilter to:', activeHallTab === 'm' ? 'male' : 'female');
  }, [activeHallTab]);
  const [pausedAnimations, setPausedAnimations] = useState(new Set()); // שולחנות שעצרו את האנימציה
  const [expandedTableId, setExpandedTableId] = useState(null); // השולחן שהמוזמנים שלו מוצגים

  // עדכון הנתונים כשהם משתנים מהדשבורד
  useEffect(() => {
    setRealTimeSeatings(seatings);
    console.log('RealTimeSeatingMap received seatings:', seatings);
    console.log('RealTimeSeatingMap received tables:', tables);
    console.log('Number of seatings:', seatings.length);
    console.log('Number of tables:', tables.length);
    console.log('Current genderFilter:', genderFilter);
    console.log('Current activeHallTab:', activeHallTab);
    
    // Debug: Log each seating
    seatings.forEach((seating, index) => {
      console.log(`Seating ${index + 1}:`, {
        id: seating.id,
        guest_id: seating.guest_id,
        guest_name: seating.guest_name,
        guest_gender: seating.guest_gender,
        table_id: seating.table_id,
        table_number: seating.table_number,
        is_occupied: seating.is_occupied,
        occupied_at: seating.occupied_at
      });
    });
  }, [seatings]);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8001/realtime/ws/${eventId}`);
    
    ws.onopen = () => {
      console.log('WebSocket connected for seating map');
      setIsConnected(true);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data);
      
      if (data.type === 'guest_arrived') {
        console.log('Guest arrived:', data.guest);
        // אין רענון עמוד — ההורה (RealTimeDashboard) כבר טוען מחדש נתונים דרך ה-WebSocket שלו
        // כאן נשאיר לוג בלבד כדי לא להחליף טאב
      } else if (data.type === 'table_full') {
        console.log('Table full notification:', data);
        // אפשר להוסיף התראה מיוחדת לשולחן מלא
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected for seating map');
      setIsConnected(false);
    };
    
    return () => ws.close();
  }, [eventId, realTimeSeatings, onSeatingsUpdate]);

  const getSeatColor = (seating) => {
    if (seating.is_occupied) {
      // צבעים שונים לגברים ונשים
      if (seating.guest_gender === 'male') {
        return '#4A90E2'; // כחול לגברים
      } else if (seating.guest_gender === 'female') {
        return '#E91E63'; // ורוד לנשים
      }
      return '#C0C0C0'; // כסף - ברירת מחדל
    }
    if (seating.guest_id) {
      return '#90EE90'; // ירוק בהיר - מוקצה אבל לא נכנס
    }
    return '#FFFFFF'; // לבן - פנוי
  };

  const getSeatStatus = (seating) => {
    if (seating.is_occupied) {
      return 'occupied';
    }
    if (seating.guest_id) {
      return 'assigned';
    }
    return 'empty';
  };

  const handleTableClick = (tableId) => {
    setPausedAnimations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tableId)) {
        newSet.delete(tableId); // הפעל מחדש את האנימציה
      } else {
        newSet.add(tableId); // עצור את האנימציה
      }
      return newSet;
    });
  };

  const getTableStatus = (table) => {
    const tableSeatings = realTimeSeatings.filter(s => s.table_id === table.id);
    const occupiedSeats = tableSeatings.filter(s => s.is_occupied).length;
    const totalSeats = table.size; // השתמש בגודל האמיתי של השולחן
    
    console.log(`Table ${table.table_number} status calculation:`, {
      table_id: table.id,
      tableSeatings: tableSeatings.length,
      occupiedSeats: occupiedSeats,
      totalSeats: totalSeats,
      tableSize: table.size,
      seatings: tableSeatings.map(s => ({
        guest_name: s.guest_name,
        is_occupied: s.is_occupied,
        guest_gender: s.guest_gender
      }))
    });
    
    if (totalSeats === 0) return 'empty';
    if (occupiedSeats === 0) return 'empty';
    if (occupiedSeats > totalSeats) return 'overbooked';
    if (occupiedSeats === totalSeats) return 'full';
    
    // בדיקה אם השולחן כמעט מלא (80%+)
    const occupancyPercentage = (occupiedSeats / totalSeats) * 100;
    if (occupancyPercentage >= 80) return 'almost_full';
    
    return 'partial';
  };

  const getTableStatusColor = (status) => {
    switch (status) {
      case 'empty':
        return '#E8F5E8';
      case 'partial':
        return '#FFF3CD';
      case 'almost_full':
        return '#FFE0B2'; // כתום לשולחנות כמעט מלאים
      case 'full':
        return '#FFCDD2'; // אדום לשולחנות מלאים
      case 'overbooked':
        return '#F8D7DA';
      default:
        return '#FFFFFF';
    }
  };

  const getTableStatusText = (status) => {
    switch (status) {
      case 'empty':
        return 'ריק';
      case 'partial':
        return 'חלקי';
      case 'almost_full':
        return 'כמעט מלא';
      case 'full':
        return 'מלא';
      case 'overbooked':
        return 'עודף';
      default:
        return '';
    }
  };

  // סינון מושבים לפי מגדר
  const filteredSeatings = realTimeSeatings.filter(seating => {
    if (genderFilter === 'all') return true;
    if (genderFilter === 'male') return seating.guest_gender === 'male';
    if (genderFilter === 'female') return seating.guest_gender === 'female';
    return true;
  });

  // חישוב סטטיסטיקות
  const totalSeatings = realTimeSeatings.length;
  const occupiedSeatings = realTimeSeatings.filter(s => s.is_occupied).length;
  const maleSeatings = realTimeSeatings.filter(s => s.guest_gender === 'male' && s.is_occupied).length;
  const femaleSeatings = realTimeSeatings.filter(s => s.guest_gender === 'female' && s.is_occupied).length;

  console.log('Seating Map Statistics:', {
    totalSeatings: totalSeatings,
    occupiedSeatings: occupiedSeatings,
    maleSeatings: maleSeatings,
    femaleSeatings: femaleSeatings,
    allSeatings: realTimeSeatings.map(s => ({
      guest_name: s.guest_name,
      guest_gender: s.guest_gender,
      is_occupied: s.is_occupied,
      table_number: s.table_number
    }))
  });

  return (
    <div className="realtime-seating-map" style={{
      minHeight: '100vh',
      background: 'var(--color-bg, #F7FAFC)',
      padding: '24px'
    }}>
      {/* Main Content Layout - Full Width */}
      <div className="main-content-layout-full">
        {/* Seating Map - Full Width */}
        <div className="seating-map-full" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '20px',
          padding: '24px',
          width: '100%'
        }}>
        {Array.isArray(tables) && tables.length > 0 ? (
          tables
            .filter(table => {
              // הפילטר עובד לפי hall_type של השולחן
              console.log(`Filtering table ${table.table_number}:`, {
                table_hall_type: table.hall_type,
                genderFilter: genderFilter,
                shouldShow: (genderFilter === 'male' && table.hall_type === 'm') || 
                           (genderFilter === 'female' && table.hall_type === 'w')
              });
              
              if (genderFilter === 'male') return table.hall_type === 'm';
              if (genderFilter === 'female') return table.hall_type === 'w';
              
              return false; // אם אין פילטר מתאים, אל תציג
            })
            .map(table => {
              const tableStatus = getTableStatus(table);
              // השתמש בכל המושבים של השולחן
              const tableSeatings = realTimeSeatings.filter(s => s.table_id === table.id);
              const occupiedCount = tableSeatings.filter(s => s.is_occupied).length;
              const totalCount = table.size; // השתמש בגודל האמיתי של השולחן
              
              // יצירת רשימת אורחים מהמושבים התפוסים
              const tableGuests = tableSeatings
                .filter(s => s.is_occupied && s.guest_name)
                .map(s => ({ 
                  name: s.guest_name, 
                  full_name: s.guest_name,
                  id: s.guest_id 
                }));
              
              const allTableGuests = tableSeatings
                .filter(s => s.guest_name)
                .map(s => ({
                  name: s.guest_name,
                  is_occupied: s.is_occupied,
                  gender: s.guest_gender
                }));
              
              const statusColors = {
                empty: { bg: 'rgba(232, 245, 232, 0.3)', border: 'rgba(46, 125, 50, 0.2)', text: '#2e7d32' },
                partial: { bg: 'rgba(255, 243, 205, 0.3)', border: 'rgba(133, 100, 4, 0.2)', text: '#856404' },
                almost_full: { bg: 'rgba(255, 224, 178, 0.3)', border: 'rgba(255, 152, 0, 0.3)', text: '#F59E0B' },
                full: { bg: 'rgba(255, 205, 210, 0.3)', border: 'rgba(244, 67, 54, 0.3)', text: '#EF4444', pulse: true },
                overbooked: { bg: 'rgba(248, 215, 218, 0.3)', border: 'rgba(244, 67, 54, 0.4)', text: '#DC2626', pulse: true }
              };
              
              const statusConfig = statusColors[tableStatus] || statusColors.empty;
              
              return (
                <div 
                  key={table.id} 
                  className={`table-container ${tableStatus} ${pausedAnimations.has(table.id) ? 'animation-paused' : ''}`}
                  style={{ 
                    background: 'transparent',
                    borderRadius: '24px',
                    padding: '20px',
                    boxShadow: 'none',
                    border: `2px solid ${statusConfig.border}`,
                    position: 'relative',
                    overflow: 'visible',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 48px rgba(15, 23, 42, 0.16)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(15, 23, 42, 0.12)';
                  }}
                  onClick={() => handleTableClick(table.id)}
                  title={pausedAnimations.has(table.id) ? 'לחץ להפעלת אנימציה' : 'לחץ לעצירת אנימציה'}
                >
                  {/* תמונת השולחן */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    marginTop: '0',
                    marginBottom: '20px',
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    WebkitFontSmoothing: 'antialiased',
                    padding: '20px',
                    background: statusConfig.bg,
                    borderRadius: '20px',
                    border: `1px solid ${statusConfig.border}`,
                    minHeight: '160px',
                    width: '100%',
                    boxSizing: 'border-box',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '120px',
                      height: '120px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      <TableVisual
                        table={table}
                        isDragging={false}
                        isViewer={true}
                        onMouseDown={() => {}}
                        style={{ 
                          width: '120px',
                          height: '120px',
                          transform: 'translateZ(0)',
                          backfaceVisibility: 'hidden',
                          WebkitFontSmoothing: 'antialiased'
                        }}
                        tableNumber={table.table_number || table.id}
                        guests={tableGuests}
                        hallType={activeHallTab}
                      />
                    </div>
                  </div>
                  
                <div style={{ 
                  textAlign: 'center', 
                  marginBottom: '16px' 
                }}>
                  <h3 style={{ 
                    margin: '0 0 12px 0', 
                    fontSize: '18px', 
                    fontWeight: 700, 
                    color: 'var(--color-text-main, #10131A)',
                    fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    letterSpacing: '-0.3px'
                  }}>
                    שולחן {table.table_number}
                  </h3>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: '10px', 
                    flexWrap: 'wrap',
                    marginBottom: '8px'
                  }}>
                    <span style={{ 
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '6px 14px',
                      borderRadius: '999px',
                      background: statusConfig.bg,
                      color: statusConfig.text,
                      border: `1px solid ${statusConfig.border}`,
                      fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                      letterSpacing: '0.3px',
                      textTransform: 'uppercase'
                    }}>
                      {getTableStatusText(tableStatus)}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ 
                      fontSize: '20px', 
                      fontWeight: 700, 
                      color: 'var(--color-text-main, #10131A)',
                      fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    }}>
                      {occupiedCount}
                    </span>
                    <span style={{ 
                      fontSize: '16px', 
                      fontWeight: 500, 
                      color: 'var(--color-text-secondary, #6B7280)',
                      fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                    }}>
                      /{totalCount}
                    </span>
                    {totalCount > 0 && (
                      <span style={{ 
                        fontSize: '13px', 
                        fontWeight: 600,
                        color: statusConfig.text,
                        padding: '4px 10px',
                        background: statusConfig.bg,
                        borderRadius: '999px',
                        marginRight: '8px',
                        fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                      }}>
                        {Math.round((occupiedCount / totalCount) * 100)}%
                      </span>
                    )}
                  </div>
                  {pausedAnimations.has(table.id) && (
                    <div style={{ 
                      marginTop: '8px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-secondary, #6B7280)' }}>
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* כפתור הצגת מוזמנים */}
                {allTableGuests.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedTableId(expandedTableId === table.id ? null : table.id);
                    }}
                    style={{ 
                      fontSize: '13px', 
                      padding: '10px 20px',
                      width: '100%',
                      borderRadius: '999px',
                      border: 'none',
                      background: expandedTableId === table.id 
                        ? 'linear-gradient(135deg, #09b0cb, #0bc4e0)'
                        : 'rgba(9, 176, 203, 0.1)',
                      color: expandedTableId === table.id ? 'white' : '#09b0cb',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                      boxShadow: expandedTableId === table.id 
                        ? '0 4px 12px rgba(9, 176, 203, 0.3)'
                        : 'none'
                    }}
                    onMouseEnter={(e) => {
                      if (expandedTableId !== table.id) {
                        e.currentTarget.style.background = 'rgba(9, 176, 203, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (expandedTableId !== table.id) {
                        e.currentTarget.style.background = 'rgba(9, 176, 203, 0.1)';
                      }
                    }}
                  >
                    {expandedTableId === table.id ? 'הסתר מוזמנים' : 'הצגת מוזמנים'}
                  </button>
                )}
                
                {/* Tooltip עם רשימת המוזמנים - מופיע בלחיצה על הכפתור */}
                {expandedTableId === table.id && allTableGuests.length > 0 && (
                  <div 
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        setExpandedTableId(null);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(255, 255, 255, 0.98)',
                      backdropFilter: 'blur(30px)',
                      WebkitBackdropFilter: 'blur(30px)',
                      borderRadius: '24px',
                      boxShadow: '0 12px 48px rgba(15, 23, 42, 0.2)',
                      padding: '20px',
                      zIndex: 10000,
                      animation: 'fadeIn 0.2s ease-out',
                      display: 'flex',
                      flexDirection: 'column',
                      border: `2px solid ${statusConfig.border}`,
                      cursor: 'pointer'
                    }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedTableId(null);
                      }}
                      title="סגור"
                      style={{ 
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
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
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        maxHeight: '100%',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        marginTop: '8px',
                        paddingTop: '8px',
                        cursor: 'default'
                      }}>
                      {allTableGuests.map((guest, idx) => (
                        <div 
                          key={idx} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '12px 16px',
                            borderRadius: '16px',
                            border: `1px solid ${guest.is_occupied 
                              ? (guest.gender === 'male' ? 'rgba(74, 144, 226, 0.3)' : 'rgba(233, 30, 99, 0.3)')
                              : 'rgba(255, 152, 0, 0.3)'}`,
                            background: guest.is_occupied 
                              ? (guest.gender === 'male' 
                                ? 'rgba(74, 144, 226, 0.1)' 
                                : 'rgba(233, 30, 99, 0.1)')
                              : 'rgba(255, 152, 0, 0.1)',
                            transition: 'all 0.2s ease',
                            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                          }}
                        >
                          <span style={{ 
                            fontSize: '14px',
                            color: 'var(--color-text-main, #10131A)',
                            fontWeight: 600,
                            textAlign: 'center',
                            width: '100%'
                          }}>
                            {guest.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '80px 40px', 
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)',
            maxWidth: '500px',
            margin: '40px auto'
          }}>
            <div style={{ 
              width: 64,
              height: 64,
              borderRadius: '20px',
              margin: '0 auto 24px',
              background: 'rgba(9, 176, 203, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(9, 176, 203, 0.2)'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#09b0cb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
            </div>
            <div style={{ 
              fontSize: '22px', 
              fontWeight: 700, 
              marginBottom: '12px', 
              color: 'var(--color-text-main, #10131A)',
              fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}>
              אין שולחנות זמינים
            </div>
            <div style={{ 
              fontSize: '15px', 
              color: 'var(--color-text-secondary, #6B7280)', 
              marginBottom: '24px',
              fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}>
              הוסף שולחנות בהגדרות האירוע
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeSeatingMap; 