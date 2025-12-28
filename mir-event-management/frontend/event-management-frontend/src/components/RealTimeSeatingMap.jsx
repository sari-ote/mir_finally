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
    <div className="realtime-seating-map">
      {/* Main Content Layout - Full Width */}
      <div className="main-content-layout-full">
        {/* Seating Map - Full Width */}
        <div className="seating-map-full">
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
              
              return (
                <div 
                  key={table.id} 
                  className={`table-container ${tableStatus} ${pausedAnimations.has(table.id) ? 'animation-paused' : ''}`}
                  style={{ backgroundColor: getTableStatusColor(tableStatus), position: 'relative' }}
                  onClick={() => handleTableClick(table.id)}
                  title={pausedAnimations.has(table.id) ? 'לחץ להפעלת אנימציה' : 'לחץ לעצירת אנימציה'}
                >
                  {/* תמונת השולחן */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    marginBottom: '8px',
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    WebkitFontSmoothing: 'antialiased'
                  }}>
                    <TableVisual
                      table={table}
                      isDragging={false}
                      isViewer={true}
                      onMouseDown={() => {}}
                      style={{ 
                        position: 'relative', 
                        left: 0, 
                        top: 0, 
                        width: '84px',
                        height: '84px',
                        transform: 'translateZ(0)',
                        backfaceVisibility: 'hidden',
                        WebkitFontSmoothing: 'antialiased'
                      }}
                      tableNumber={table.table_number || table.id}
                      guests={tableGuests}
                      hallType={activeHallTab}
                    />
                  </div>
                  
                <div style={{ 
                  textAlign: 'center', 
                  marginBottom: '12px' 
                }}>
                  <h3 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '16px', 
                    fontWeight: 600, 
                    color: 'var(--color-text-main, #10131A)' 
                  }}>
                    שולחן {table.table_number}
                  </h3>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: '8px', 
                    flexWrap: 'wrap' 
                  }}>
                    <span className={`tropical-badge ${tableStatus === 'full' ? 'tropical-badge-error' : tableStatus === 'almost_full' ? 'tropical-badge-warning' : tableStatus === 'empty' ? 'tropical-badge-success' : 'tropical-badge-primary'}`} style={{ fontSize: '11px' }}>
                      {getTableStatusText(tableStatus)}
                    </span>
                    <span style={{ 
                      fontSize: '13px', 
                      fontWeight: 600, 
                      color: 'var(--color-text-main, #10131A)' 
                    }}>
                      {occupiedCount}/{totalCount}
                    </span>
                    {totalCount > 0 && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: 'var(--color-text-secondary, #6B7280)' 
                      }}>
                        ({Math.round((occupiedCount / totalCount) * 100)}%)
                      </span>
                    )}
                  </div>
                  {pausedAnimations.has(table.id) && (
                    <div style={{ 
                      marginTop: '4px', 
                      fontSize: '16px' 
                    }}>
                      ⏸️
                    </div>
                  )}
                </div>
                
                {/* כפתור הצגת מוזמנים */}
                {allTableGuests.length > 0 && (
                  <button
                    className="tropical-button-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedTableId(expandedTableId === table.id ? null : table.id);
                    }}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    {expandedTableId === table.id ? 'הסתר מוזמנים' : 'הצגת מוזמנים'}
                  </button>
                )}
                
                {/* Tooltip עם רשימת המוזמנים - מופיע בלחיצה על הכפתור */}
                {expandedTableId === table.id && allTableGuests.length > 0 && (
                  <div className="table-guests-tooltip">
                    <button
                      className="tropical-button-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedTableId(null);
                      }}
                      title="סגור"
                      style={{ padding: '4px 8px', minWidth: 'auto', fontSize: '14px' }}
                    >
                      ×
                    </button>
                    <div className="tooltip-guests-list">
                      {allTableGuests.map((guest, idx) => (
                        <div 
                          key={idx} 
                          className={`tooltip-guest-item ${guest.is_occupied ? 'occupied' : 'assigned'} ${guest.gender || ''}`}
                        >
                          <span className="guest-name-text">{guest.name}</span>
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
            padding: '60px 20px', 
            color: 'var(--color-text-secondary, #6B7280)',
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.5 }}>📋</div>
            <div className="tropical-section-title" style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--color-text-main, #10131A)' }}>אין שולחנות זמינים</div>
            <div className="tropical-subtitle" style={{ opacity: 0.7, marginBottom: '20px' }}>הוסף שולחנות בהגדרות האירוע</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary, #9CA3AF)', marginTop: '10px' }}>
              Debug: tables={Array.isArray(tables) ? tables.length : 'not array'}, 
              genderFilter={genderFilter}, 
              activeHallTab={activeHallTab}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeSeatingMap; 