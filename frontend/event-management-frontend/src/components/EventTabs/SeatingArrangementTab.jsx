import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useDrag, useDrop } from "react-dnd";
import TableVisual from '../TableVisual';
import HallMapOverlay from '../HallMapOverlay';
import HallMapInline from '../HallMapInline';
import { useRef } from "react";
import "../../styles/theme-tropical.css";

// קטגוריה נגררת (רק Drag, לא Drop)
function CategoryTag({ category, count }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "CATEGORY",
    item: { category },
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() })
  }), [category]);
  return (
    <div
      ref={drag}
      className={`category-tag ${isDragging ? 'dragging' : ''}`}
    >
      {category} <span className="count">({count})</span>
    </div>
  );
}

// קומפוננטה לאורח נגרר כתגית עגולה/
function Guest({ guest }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "GUEST",
    item: { ...guest },
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() })
  }), [guest]);
	// הצגת שם עם פולבאק לשדות שונים
	const displayName = (
		guest.full_name ||
		guest.name ||
		guest["שם מלא"] ||
		[guest["שם"], guest["שם משפחה"]].filter(Boolean).join(' ') ||
		[guest["שם פרטי"], guest["שם משפחה"]].filter(Boolean).join(' ') ||
		[guest.first_name, guest.last_name].filter(Boolean).join(' ') ||
		[guest.firstName, guest.lastName].filter(Boolean).join(' ') ||
		guest["טלפון"] ||
		guest.phone ||
		(guest.id ? `#${guest.id}` : "ללא שם")
	);
  return (
		<div
      ref={drag}
      className={`guest-tag ${isDragging ? 'dragging' : ''}`}
    >
			{displayName}
		</div>
  );
}

function Table({ table, onDropGuest, onRemoveGuest, onDropCategory, overCapacity, seatsLeft }) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ["GUEST", "CATEGORY"],
    drop: (item) => {
      if (item.category) {
        onDropCategory(table, item.category);
      } else {
        onDropGuest(table, item);
      }
    },
    collect: (monitor) => ({ isOver: !!monitor.isOver() })
  }), [table, onDropGuest, onDropCategory]);

  return (
    <div ref={drop} style={{ margin: 32 }}>
      <TableVisual
        table={table}
        isDragging={false}
        isViewer={false}
        onMouseDown={() => {}}
        style={{ position: 'relative', left: 0, top: 0 }}
        tableNumber={table.table_number || table.id}
        guests={table.guests || []}
      />
      
      {/* מידע נוסף על השולחן */}
      <div className="table-info-card">
        <div className="table-info-title">
          {table.table_number || table.name}
        </div>
        <div className={`table-info-capacity ${overCapacity ? 'over-capacity' : seatsLeft === 0 ? 'full' : 'available'}`}>
          {table.guests.length}/{table.size} מקומות תפוסים
        </div>
        
        {/* רשימת אורחים */}
        <div className="table-guests-list">
          {table.guests.map(g => (
            <Guest key={g.id} guest={g} />
          ))}
        </div>
        
        {/* הודעות מצב */}
        <div className="table-status-messages">
          {overCapacity && (
            <div className="table-over-capacity">
              חריגה של {Math.abs(seatsLeft)}
            </div>
          )}
          {seatsLeft > 0 && (
            <div className="table-available-seats">
              נותרו {seatsLeft} מקומות
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Drop target ל-unassigned (רשימת קטגוריות) – מאפשר להחזיר אורח בגרירה
function UnassignedDropZone({ onDrop, onDropTableCategory, children }) {
  const [{ isOver }, drop] = useDrop(() => ({
		accept: ["GUEST", "TABLE_CATEGORY"],
		drop: (item) => {
			if (item && item.tableId) {
				onDropTableCategory?.(item.tableId);
			} else if (item && item.id) {
				onDrop?.(item);
			}
		},
    collect: (monitor) => ({ isOver: !!monitor.isOver() })
	}), [onDrop, onDropTableCategory]);
  return (
    <div ref={drop} className={`unassigned-drop-zone ${isOver ? 'hover' : ''}`}>
      {children}
    </div>
  );
}

export default function SeatingArrangementTab({ eventId }) {
  console.log('SeatingArrangementTab: eventId from props:', eventId);
  const [activeHallTab, setActiveHallTab] = useState('m'); // 'm' = גברים, 'w' = נשים
  const [guests, setGuests] = useState([]);
  const [tables, setTables] = useState([]);
  const [seatings, setSeatings] = useState([]);
  const [tableHeads, setTableHeads] = useState([]);
  const [hallElements, setHallElements] = useState([]);
  const [loading, setLoading] = useState(true);
	const [showHallMap, setShowHallMap] = useState(false);
	const [availableCategories, setAvailableCategories] = useState([]);
	
	// תמונת אולם שהמשתמש מעלה (נשמרת מקומית לפי אירוע ואולם)
	const [hallImageDataUrl, setHallImageDataUrl] = useState(null);

  // מצב עריכה חדש
  const [isEditMode, setIsEditMode] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
	// הצגה זה-לצד-זה של המפה והתמונה
	const [sideBySide, setSideBySide] = useState(false);
	// זיהוי רוחב לצורך שבירה לשורה
	const mapImageContainerRef = useRef(null);
	const [isNarrow, setIsNarrow] = useState(false);
	// מצב גרירת קובץ מעל המפה
	const [mapFileOver, setMapFileOver] = useState(false);
	// הצגת תמונת אולם (ללא מחיקה)
	const [showHallImage, setShowHallImage] = useState(true);
	// גדלים קבועים לתצוגה
	const MAP_HEIGHT = 600;
	const IMAGE_HEIGHT = 360; // קטן יחסית למפה

	useEffect(() => {
		const handleResize = () => {
			const w = mapImageContainerRef.current?.clientWidth || window.innerWidth;
			setIsNarrow(w < 900);
		};
		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

  const role = localStorage.getItem("role");
  const isViewer = role === "viewer";

  // Fetch all data for the selected hall
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        console.log('מתחיל לטעון נתונים...');
        const token = localStorage.getItem('access_token');
        
        // בדיקה אם יש token
        if (!token) {
          console.error('אין token זמין');
          return;
        }
        
        const [guestsData, tablesData, seatingsData, tableHeadsData, hallElementsData] = await Promise.all([
          fetch(`http://localhost:8001/guests/event/${eventId}/with-fields`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => {
            if (!res.ok) {
              throw new Error(`שגיאה בטעינת מוזמנים: ${res.status}`);
            }
            return res.json();
          }),
          fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => {
            if (!res.ok) {
              throw new Error(`שגיאה בטעינת שולחנות: ${res.status}`);
            }
            return res.json();
          }),
          fetch(`http://localhost:8001/seatings/event/${eventId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => {
            if (!res.ok) {
              throw new Error(`שגיאה בטעינת מקומות ישיבה: ${res.status}`);
            }
            return res.json();
          }),
          fetch(`http://localhost:8001/tables/table-heads/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => {
            if (!res.ok) {
              throw new Error(`שגיאה בטעינת ראשי שולחן: ${res.status}`);
            }
            return res.json();
          }),
          fetch(`http://localhost:8001/tables/hall-elements/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => {
            if (!res.ok) {
              throw new Error(`שגיאה בטעינת אלמנטי אולם: ${res.status}`);
            }
            return res.json();
          }),
        ]);
        
        console.log('נתונים שהתקבלו:', {
          guests: guestsData,
          tables: tablesData,
          seatings: seatingsData,
          tableHeads: tableHeadsData,
          hallElements: hallElementsData
        });
        
        setGuests(Array.isArray(guestsData) ? guestsData : []);
        setTables(Array.isArray(tablesData) ? tablesData : []);
        setSeatings(Array.isArray(seatingsData) ? seatingsData : []);
        setTableHeads(Array.isArray(tableHeadsData) ? tableHeadsData : []);
        setHallElements(Array.isArray(hallElementsData) ? hallElementsData : []);
        
        console.log('נתונים נשמרו במצב');
      } catch (error) {
        console.error('Error fetching data:', error);
        alert(`שגיאה בטעינת נתונים: ${error.message}`);
      } finally {
        setLoading(false);
        console.log('טעינה הסתיימה');
      }
    };
    
    fetchAll();
  }, [eventId, activeHallTab]);

  // רענון אוטומטי כל 5 שניות כדי לסנכרן עם שינויים בטאב הגדרות
  useEffect(() => {
    const interval = setInterval(() => {
      const fetchAll = async () => {
        try {
          const token = localStorage.getItem('access_token');
          if (!token) return;
          
          const [tablesData, hallElementsData] = await Promise.all([
            fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
              headers: { "Authorization": `Bearer ${token}` }
            }).then(res => res.ok ? res.json() : []),
            fetch(`http://localhost:8001/tables/hall-elements/event/${eventId}?hall_type=${activeHallTab}`, {
              headers: { "Authorization": `Bearer ${token}` }
            }).then(res => res.ok ? res.json() : [])
          ]);
          
          setTables(Array.isArray(tablesData) ? tablesData : []);
          setHallElements(Array.isArray(hallElementsData) ? hallElementsData : []);
          console.log('🔄 Auto-refreshed data from server');
        } catch (error) {
          console.error('Error auto-refreshing data:', error);
        }
      };
      
      fetchAll();
    }, 5000); // רענון כל 5 שניות
    
    return () => clearInterval(interval);
  }, [eventId, activeHallTab]);

	// טען קטגוריות זמינות לפי אולם (מגדר)
	useEffect(() => {
		const loadCategories = async () => {
			try {
				const token = localStorage.getItem('access_token');
				const r = await fetch(`http://localhost:8001/tables/table-heads/event/${eventId}`, { headers: { 'Authorization': `Bearer ${token}` } });
				if (!r.ok) { setAvailableCategories([]); return; }
				const list = await r.json();
				const gender = activeHallTab === 'm' ? 'male' : 'female';
				const cats = Array.from(new Set((list || []).filter(th => (th.gender || '').toLowerCase() === gender).map(th => (th.category || '').trim()).filter(Boolean)));
				setAvailableCategories(cats);
			} catch (e) {
				setAvailableCategories([]);
			}
		};
		loadCategories();
	}, [eventId, activeHallTab]);

	// טען תמונת אולם מ-localStorage לפי אירוע ואולם
	useEffect(() => {
		try {
			const key = `hallImage_${eventId}_${activeHallTab}`;
			const saved = localStorage.getItem(key);
			setHallImageDataUrl(saved || null);
			setShowHallImage(!!saved);
		} catch {}
	}, [eventId, activeHallTab]);

	// שמור/נקה תמונת אולם ב-localStorage על שינוי
	useEffect(() => {
		try {
			const key = `hallImage_${eventId}_${activeHallTab}`;
			if (hallImageDataUrl) localStorage.setItem(key, hallImageDataUrl);
			else localStorage.removeItem(key);
		} catch {}
	}, [hallImageDataUrl, eventId, activeHallTab]);

	const handleChangeTableCategory = async (tableId, category) => {
		const prevTables = tables;
		// optimistic update
		setTables(prev => prev.map(t => t.id === tableId ? { ...t, category } : t));
		try {
			const token = localStorage.getItem('access_token');
			const res = await fetch(`http://localhost:8001/tables/${tableId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
				body: JSON.stringify({ category: category || null })
			});
			if (res.ok) return;
			// Fallback to bulk
			const updatedTables = (prevTables || []).map(t => t.id === tableId ? { ...t, category } : t);
			const payload = updatedTables.map((t, idx) => ({
				event_id: Number(eventId),
				table_number: t.table_number || (idx + 1),
				size: Number(t.size),
				shape: t.shape || 'circular',
				x: Math.round(t.x || 0),
				y: Math.round(t.y || 0),
				table_head: null,
				category: (t.category || '') || null,
				hall_type: activeHallTab,
			}));
			const bulkUrl = `http://localhost:8001/tables/event/${eventId}/bulk?hall_type=${activeHallTab}`;
			const bulkRes = await fetch(bulkUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
				body: JSON.stringify(payload)
			});
			if (bulkRes.ok) return;
			throw new Error(`PUT failed (${res.status}), BULK failed (${bulkRes.status})`);
		} catch (e) {
			console.error('Failed to update table category with fallback', e);
			alert('שגיאה בעדכון קטגוריה לשולחן');
			// rollback
			setTables(prevTables);
		}
	};

	const handleClearTableCategory = (tableId) => handleChangeTableCategory(tableId, '');

	// הוספה/הורדה של כסא (עדכון size) לשולחן
	const adjustTableSize = async (tableId, delta) => {
		const t = tables.find(t => t.id === tableId);
		if (!t) return;
		const newSize = Math.max(1, Number(t.size || 0) + delta);
		const prevTables = tables;
		setTables(prev => prev.map(x => x.id === tableId ? { ...x, size: newSize } : x));
		try {
			const token = localStorage.getItem('access_token');
			const res = await fetch(`http://localhost:8001/tables/${tableId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
				body: JSON.stringify({ size: newSize })
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
		} catch (e) {
			console.error('Failed to update table size', e);
			setTables(prevTables);
			alert('שגיאה בעדכון מספר הכיסאות');
		}
	};

	const handleAddSeatToTable = (tableId) => adjustTableSize(tableId, +1);
	const handleRemoveSeatFromTable = (tableId) => adjustTableSize(tableId, -1);

  // טעינת אפשרויות פילטרים זמינות
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://localhost:8001/seatings/filter-options/${eventId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          // setAvailableFilters(data.available_filters); // This line is removed
        }
      } catch (error) {
        console.error('שגיאה בטעינת אפשרויות פילטרים:', error);
      }
    };
    
    fetchFilterOptions();
  }, [eventId]);

  // Filter only guests who confirmed arrival
  const confirmedGuests = guests.filter(g => !!g.confirmed_arrival);

  // Build table->guests mapping
  const tablesWithGuests = tables.map(table => {
    const guestsAtTable = seatings
      .filter(s => s.table_id === table.id)
      .map(s => confirmedGuests.find(g => g.id === s.guest_id))
      .filter(Boolean);
    return {
      ...table,
      guests: guestsAtTable,
      seatings: seatings.filter(s => s.table_id === table.id),
      overCapacity: guestsAtTable.length > table.size,
			seatsLeft: table.size - guestsAtTable.length,
			occupied: guestsAtTable.length
    };
  });

  console.log('מצב נוכחי:', {
    loading,
    guests: confirmedGuests.length,
    tables: tables.length,
    seatings: seatings.length,
    tablesWithGuests: tablesWithGuests.length,
    activeHallTab
  });

  // Guests not assigned to any table (filter only guests for this hall)
  const gender = activeHallTab === 'm' ? 'male' : 'female';
  const genderHeb = activeHallTab === 'm' ? 'זכר' : 'נקבה';
  const assignedGuestIds = new Set(seatings.map(s => s.guest_id));
  const unassignedGuests = confirmedGuests.filter(
    g =>
      !assignedGuestIds.has(g.id) &&
      (g.gender === gender || g["מין"] === genderHeb)
  );
	// Only guests without any category (no table_head mapping to category)
	const uncategorizedUnassignedGuests = unassignedGuests.filter(g => {
		const tableHeadId = g.table_head_id;
		const th = tableHeads.find(h => h.id === Number(tableHeadId));
		const cat = (th?.category || '').trim();
		return !cat || cat === 'ללא קטגוריה';
	});
  
  // לוגים נוספים
  console.log("guests", guests);
  console.log("seatings", seatings);
  console.log("assignedGuestIds", Array.from(assignedGuestIds));
  console.log("unassignedGuests", unassignedGuests);
	console.log("uncategorizedUnassignedGuests", uncategorizedUnassignedGuests); // לוג לבדיקה
  // סנן את tableHeads לפי מגדר האולם
  const tableHeadsForHall = tableHeads.filter(h => h.gender === gender);
  console.log("tableHeadsForHall", tableHeadsForHall); // לוג לבדיקה

  // קטגוריות לא משובצות
  const categoryGuestsMap = {};
  unassignedGuests.forEach(guest => {
    const tableHeadId = guest.table_head_id;
    const tableHead = tableHeadsForHall.find(h => h.id === Number(tableHeadId));
    const category = tableHead?.category || "ללא קטגוריה";
    if (!categoryGuestsMap[category]) categoryGuestsMap[category] = [];
    categoryGuestsMap[category].push(guest);
  });
  const categoriesList = Object.entries(categoryGuestsMap); // [ [קטגוריה, [אורחים]], ... ]
  console.log("unassignedGuests", unassignedGuests); // לוג לבדיקה

  // Drag & Drop handlers
  const handleDropGuest = async (table, guest) => {
    if (!isEditMode) return; // לא מאפשר שינויים במצב צפייה
    
    try {
      const token = localStorage.getItem('access_token');
      
      // בדוק אם המוזמן כבר מוקצה לשולחן אחר
      const existingSeating = seatings.find(s => s.guest_id === guest.id);
      
      if (existingSeating) {
        console.log('מוזמן כבר מוקצה לשולחן אחר, מוחק הקצאה קודמת...');
        
        // מחק את ההקצאה הקודמת
        const deleteResponse = await fetch(`http://localhost:8001/seatings/${existingSeating.id}`, {
          method: 'DELETE',
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json();
          console.error('Error deleting existing seating:', errorData);
          alert(`שגיאה במחיקת הקצאה קודמת: ${errorData.detail || 'שגיאה לא ידועה'}`);
          return;
        }
        
        console.log('הקצאה קודמת נמחקה בהצלחה');
      }
      
      const requestBody = {
        guest_id: guest.id,
        event_id: parseInt(eventId),
        table_id: table.id,
        seat_number: null
      };
      
      console.log('שולח לשרת:', requestBody);
      
      const response = await fetch(`http://localhost:8001/seatings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        console.log('המוזמן הוקצה בהצלחה');
        // רענן נתונים
      const fetchAll = async () => {
          setLoading(true);
          try {
            const token = localStorage.getItem('access_token');
        const [guestsData, tablesData, seatingsData, tableHeadsData] = await Promise.all([
          fetch(`http://localhost:8001/guests/event/${eventId}/with-fields`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/seatings/event/${eventId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/tables/table-heads/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
        ]);
        
        setGuests(Array.isArray(guestsData) ? guestsData : []);
        setTables(Array.isArray(tablesData) ? tablesData : []);
        setSeatings(Array.isArray(seatingsData) ? seatingsData : []);
        setTableHeads(Array.isArray(tableHeadsData) ? tableHeadsData : []);
          } catch (error) {
            console.error('Error fetching data:', error);
          } finally {
            setLoading(false);
          }
        };
        fetchAll();
      } else {
        const errorData = await response.json();
        console.error('Error assigning guest to table:', errorData);
        alert(`שגיאה בהקצאת מוזמן: ${errorData.detail || 'שגיאה לא ידועה'}`);
      }
    } catch (error) {
      console.error('Error unassigning guest:', error);
      alert('שגיאה בהקצאת מוזמן לשולחן');
    }
  };

  const handleRemoveGuest = async (table, guest) => {
    if (!isEditMode) return; // לא מאפשר שינויים במצב צפייה
    
    try {
      const token = localStorage.getItem('access_token');
      const seating = seatings.find(s => s.guest_id === guest.id && s.table_id === table.id);
      
      if (seating) {
      await fetch(`http://localhost:8001/seatings/${seating.id}`, { 
          method: 'DELETE',
        headers: { "Authorization": `Bearer ${token}` }
      });

        // רענן נתונים
      const fetchAll = async () => {
          setLoading(true);
          try {
            const token = localStorage.getItem('access_token');
        const [guestsData, tablesData, seatingsData, tableHeadsData] = await Promise.all([
          fetch(`http://localhost:8001/guests/event/${eventId}/with-fields`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/seatings/event/${eventId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/tables/table-heads/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
        ]);
        
        setGuests(Array.isArray(guestsData) ? guestsData : []);
        setTables(Array.isArray(tablesData) ? tablesData : []);
        setSeatings(Array.isArray(seatingsData) ? seatingsData : []);
        setTableHeads(Array.isArray(tableHeadsData) ? tableHeadsData : []);
          } catch (error) {
            console.error('Error fetching data:', error);
          } finally {
            setLoading(false);
          }
      };
        fetchAll();
      }
    } catch (error) {
      console.error('Error removing guest:', error);
    }
  };

  const handleDropCategory = async (table, category) => {
    if (!isEditMode) return; // לא מאפשר שינויים במצב צפייה
    
    try {
      const token = localStorage.getItem('access_token');
      const categoryGuests = unassignedGuests.filter(g => {
        const tableHeadId = g.table_head_id;
        const tableHead = tableHeadsForHall.find(h => h.id === Number(tableHeadId));
        return tableHead?.category === category;
      });

      console.log(`מקצה ${categoryGuests.length} מוזמנים מהקטגוריה ${category} לשולחן ${table.table_number}`);

      // הקצא את כל המוזמנים מהקטגוריה לשולחן
      for (const guest of categoryGuests) {
        // בדוק אם המוזמן כבר מוקצה לשולחן אחר
        const existingSeating = seatings.find(s => s.guest_id === guest.id);
        
        if (existingSeating) {
          console.log(`מוזמן ${guest.first_name} ${guest.last_name} כבר מוקצה, מוחק הקצאה קודמת...`);
          
          // מחק את ההקצאה הקודמת
          const deleteResponse = await fetch(`http://localhost:8001/seatings/${existingSeating.id}`, {
            method: 'DELETE',
            headers: { "Authorization": `Bearer ${token}` }
          });
          
          if (!deleteResponse.ok) {
            const errorData = await deleteResponse.json();
            console.error('Error deleting existing seating:', errorData);
            alert(`שגיאה במחיקת הקצאה קודמת: ${errorData.detail || 'שגיאה לא ידועה'}`);
            continue; // המשך למוזמן הבא
          }
        }
        
        const requestBody = {
          guest_id: guest.id,
          event_id: parseInt(eventId),
          table_id: table.id,
          seat_number: null
        };
        
        const response = await fetch(`http://localhost:8001/seatings`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Error assigning guest from category:', errorData);
          alert(`שגיאה בהקצאת מוזמן מהקטגוריה: ${errorData.detail || 'שגיאה לא ידועה'}`);
          continue; // המשך למוזמן הבא
        }
      }

      console.log('כל המוזמנים מהקטגוריה הוקצו בהצלחה');

      // רענן נתונים
      const fetchAll = async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('access_token');
        const [guestsData, tablesData, seatingsData, tableHeadsData] = await Promise.all([
          fetch(`http://localhost:8001/guests/event/${eventId}/with-fields`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/seatings/event/${eventId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/tables/table-heads/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
        ]);
        
        setGuests(Array.isArray(guestsData) ? guestsData : []);
        setTables(Array.isArray(tablesData) ? tablesData : []);
        setSeatings(Array.isArray(seatingsData) ? seatingsData : []);
        setTableHeads(Array.isArray(tableHeadsData) ? tableHeadsData : []);
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchAll();
    } catch (error) {
      console.error('Error dropping category:', error);
      alert('שגיאה בהקצאת קטגוריה לשולחן');
    }
  };

  const handleUnassignGuest = async (guest) => {
    if (!isEditMode) return; // לא מאפשר שינויים במצב צפייה
    
    try {
      const token = localStorage.getItem('access_token');
      const seating = seatings.find(s => s.guest_id === guest.id);
      
      if (seating) {
      await fetch(`http://localhost:8001/seatings/${seating.id}`, { 
          method: 'DELETE',
        headers: { "Authorization": `Bearer ${token}` }
      });

        // רענן נתונים
      const fetchAll = async () => {
          setLoading(true);
          try {
            const token = localStorage.getItem('access_token');
        const [guestsData, tablesData, seatingsData, tableHeadsData] = await Promise.all([
          fetch(`http://localhost:8001/guests/event/${eventId}/with-fields`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/seatings/event/${eventId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/tables/table-heads/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
        ]);
        
        setGuests(Array.isArray(guestsData) ? guestsData : []);
        setTables(Array.isArray(tablesData) ? tablesData : []);
        setSeatings(Array.isArray(seatingsData) ? seatingsData : []);
        setTableHeads(Array.isArray(tableHeadsData) ? tableHeadsData : []);
          } catch (error) {
            console.error('Error fetching data:', error);
          } finally {
            setLoading(false);
          }
      };
        fetchAll();
      }
    } catch (error) {
      console.error('Error unassigning guest:', error);
    }
  };

  // פונקציות חדשות לכפתורים
  const handleFinishSeating = () => {
    setIsEditMode(false);
  };

  const handleEditSeating = () => {
    setIsEditMode(true);
  };

  const handleSaveSeating = async () => {
    try {
      setLoading(true);
      
      // הנתונים כבר נשמרים אוטומטית כשמקצים מוזמנים לשולחנות
      // הפונקציה הזו רק מסמנת שהסידור הושלם
      alert('הסידור נשמר בהצלחה!');
      setIsEditMode(false);
    } catch (error) {
      console.error('Error saving seating:', error);
      alert('שגיאה בשמירת הסידור');
    } finally {
      setLoading(false);
    }
  };

  // העלאת תמונת אולם
  const handleHallImageUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setHallImageDataUrl(reader.result);
      setShowHallImage(true);
      setSideBySide(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveHallImage = () => {
    setHallImageDataUrl(null);
  };

	// Drag-n-drop של קובץ תמונה על המפה
	const handleMapDragOver = (e) => {
		const types = Array.from(e.dataTransfer?.types || []);
		if (types.includes('Files')) {
			e.preventDefault();
			setMapFileOver(true);
		}
	};
	const handleMapDragLeave = () => setMapFileOver(false);
	const handleMapDrop = (e) => {
		const files = Array.from(e.dataTransfer?.files || []);
		if (files.length === 0) { setMapFileOver(false); return; }
		e.preventDefault();
		const file = files.find(f => (f.type || '').startsWith('image/'));
		if (!file) { setMapFileOver(false); return; }
		const reader = new FileReader();
		reader.onloadend = () => {
			setHallImageDataUrl(reader.result);
			setSideBySide(true);
			setMapFileOver(false);
		};
		reader.readAsDataURL(file);
  };

  return (
    <div>
      {/* כפתורי פעולה - רק שמור ועריכה */}
      <div style={{ 
        display: 'flex', 
        gap: 10, 
        marginBottom: 20, 
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center' // מרוכז
      }}>
        
        {isEditMode ? (
          <button
            onClick={handleFinishSeating}
            style={{
              padding: '12px 28px',
              borderRadius: '999px',
              border: 'none',
              background: 'linear-gradient(135deg, #09b0cb, #0bc4e0)',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 15,
              fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              boxShadow: '0 4px 12px rgba(9, 176, 203, 0.3)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(9, 176, 203, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(9, 176, 203, 0.3)';
            }}
          >
            סיום עריכה
          </button>
        ) : (
          <>
            <button
              onClick={handleEditSeating}
              style={{
                padding: '12px 28px',
                borderRadius: '999px',
                border: 'none',
                background: 'linear-gradient(135deg, #09b0cb, #0bc4e0)',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 15,
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                boxShadow: '0 4px 12px rgba(9, 176, 203, 0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(9, 176, 203, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(9, 176, 203, 0.3)';
              }}
            >
              ערוך
            </button>
            <button
              onClick={handleSaveSeating}
              style={{
                padding: '12px 28px',
                borderRadius: '999px',
                border: 'none',
                background: 'linear-gradient(135deg, #09b0cb, #0bc4e0)',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 15,
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                boxShadow: '0 4px 12px rgba(9, 176, 203, 0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(9, 176, 203, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(9, 176, 203, 0.3)';
              }}
            >
              שמור
            </button>
          </>
        )}

			{/* מתג תצוגה זה לצד זה */}
			<div 
				onClick={() => setSideBySide(!sideBySide)}
				style={{ 
					display: 'flex', 
					alignItems: 'center', 
					gap: 12, 
					marginInlineStart: 12, 
					padding: '10px 18px',
					background: 'rgba(255, 255, 255, 0.8)',
					backdropFilter: 'blur(10px)',
					WebkitBackdropFilter: 'blur(10px)',
					borderRadius: '999px',
					border: '1px solid rgba(148, 163, 184, 0.3)',
					fontSize: 14, 
					color: '#10131A',
					fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
					fontWeight: 500,
					cursor: 'pointer',
					transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
					boxShadow: sideBySide ? '0 2px 8px rgba(9, 176, 203, 0.2)' : '0 1px 3px rgba(15, 23, 42, 0.1)',
					userSelect: 'none'
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = sideBySide 
						? 'rgba(9, 176, 203, 0.1)' 
						: 'rgba(255, 255, 255, 0.95)';
					e.currentTarget.style.borderColor = sideBySide 
						? 'rgba(9, 176, 203, 0.4)' 
						: 'rgba(148, 163, 184, 0.4)';
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
					e.currentTarget.style.borderColor = sideBySide 
						? 'rgba(9, 176, 203, 0.3)' 
						: 'rgba(148, 163, 184, 0.3)';
				}}
			>
				<div style={{
					position: 'relative',
					width: '44px',
					height: '24px',
					borderRadius: '999px',
					background: sideBySide ? '#09b0cb' : 'rgba(142, 142, 147, 0.3)',
					transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
					cursor: 'pointer',
					flexShrink: 0
				}}>
					<div style={{
						position: 'absolute',
						top: '2px',
						right: sideBySide ? '2px' : '22px',
						width: '20px',
						height: '20px',
						borderRadius: '50%',
						background: 'white',
						boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
						transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
						transform: sideBySide ? 'scale(1)' : 'scale(0.9)'
					}} />
				</div>
				<span style={{ 
					fontWeight: sideBySide ? 600 : 500,
					color: sideBySide ? '#09b0cb' : '#10131A',
					transition: 'all 0.2s ease'
				}}>
					הצג מפה ותמונה זה לצד זה
				</span>
			</div>
			{hallImageDataUrl && (
				<button 
					onClick={() => setShowHallImage(v => !v)} 
					style={{ 
						padding: '10px 20px', 
						borderRadius: '999px', 
						border: '1px solid rgba(148, 163, 184, 0.3)', 
						background: showHallImage 
							? 'rgba(9, 176, 203, 0.1)' 
							: 'rgba(255, 255, 255, 0.8)',
						backdropFilter: 'blur(10px)',
						WebkitBackdropFilter: 'blur(10px)',
						color: showHallImage ? '#09b0cb' : '#10131A', 
						fontWeight: 600, 
						cursor: 'pointer',
						fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
						fontSize: 14,
						transition: 'all 0.2s ease'
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = showHallImage 
							? 'rgba(9, 176, 203, 0.15)' 
							: 'rgba(9, 176, 203, 0.08)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = showHallImage 
							? 'rgba(9, 176, 203, 0.1)' 
							: 'rgba(255, 255, 255, 0.8)';
					}}
				>
					{showHallImage ? 'הסתר תמונה' : 'הצג תמונה'}
				</button>
        )}
      </div>

      {/* מצב עריכה */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: 16,
        padding: '10px 20px',
        background: isEditMode 
          ? 'rgba(9, 176, 203, 0.1)' 
          : 'rgba(142, 142, 147, 0.1)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '999px',
        border: `1px solid ${isEditMode ? 'rgba(9, 176, 203, 0.3)' : 'rgba(142, 142, 147, 0.3)'}`,
        display: 'inline-block',
        margin: '0 auto 16px auto'
      }}>
        <span style={{ 
          fontWeight: 600, 
          color: isEditMode ? '#09b0cb' : 'rgba(142, 142, 147, 0.9)',
          fontSize: 14,
          fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        }}>
          מצב: {isEditMode ? 'עריכה' : 'צפייה בלבד'}
        </span>
      </div>

      {/* טאבים לבחירת אולם - Switcher מודרני */}
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
        marginBottom: 24,
        width: 'fit-content',
        position: 'relative',
        margin: '0 auto 24px auto'
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
      {loading ? (
        <div style={{ textAlign: "center", fontSize: 22, padding: 40 }}>טוען...</div>
      ) : tables.length === 0 ? (
        <div style={{ textAlign: "center", fontSize: 18, padding: 40, color: "#666" }}>
          אין שולחנות לאולם זה. אנא הוסף שולחנות בהגדרות האירוע.
        </div>
      ) : (
				<div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24 }}>
					{/* רשימת קטגוריות + אורחים לא משובצים */}
					<div>
						<UnassignedDropZone onDrop={handleUnassignGuest} onDropTableCategory={handleClearTableCategory}>
            <h3 style={{ 
              fontSize: 18, 
              fontWeight: 700, 
              marginBottom: 16, 
              textAlign: 'center', 
              color: '#09b0cb',
              fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}>רשימת קטגוריות</h3>
            {categoriesList.length === 0 ? (
              <div style={{ textAlign: "center", color: "#999", fontSize: 14 }}>
									אין קטגוריות זמינות
              </div>
            ) : (
              categoriesList.map(([category, guests]) => (
              <CategoryTag key={category} category={category} count={guests.length} />
              ))
            )}

							<h3 style={{ 
              fontSize: 18, 
              fontWeight: 700, 
              margin: '24px 0 14px', 
              textAlign: 'center', 
              color: '#09b0cb',
              fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}>מוזמנים לא משובצים</h3>
							<div style={{ 
                background: 'rgba(255, 255, 255, 0.95)', 
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '18px', 
                border: '1px solid rgba(148, 163, 184, 0.2)',
                padding: 16, 
                maxHeight: 300, 
                overflowY: 'auto',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)'
              }}>
								{unassignedGuests.length === 0 ? (
									<div style={{ textAlign: 'center', color: '#888' }}>אין מוזמנים לא משובצים</div>
								) : (
									unassignedGuests.map(g => <Guest key={g.id} guest={g} />)
								)}
							</div>
          </UnassignedDropZone>
              </div>

					{/* מפה אינליין + תצוגת תמונה אופציונלית */}
					<div>
						<div ref={mapImageContainerRef} style={{ display: 'grid', gridTemplateColumns: sideBySide && hallImageDataUrl && showHallImage && !isNarrow ? '2fr 1fr' : '1fr', gap: 16, alignItems: 'start', direction: 'rtl' }}>
							<div onDragOver={handleMapDragOver} onDragLeave={handleMapDragLeave} onDrop={handleMapDrop} style={{ outline: mapFileOver ? '2px dashed #4f8cff' : 'none', background: mapFileOver ? 'rgba(79,140,255,0.06)' : undefined, borderRadius: 8, height: sideBySide && hallImageDataUrl && showHallImage && !isNarrow ? MAP_HEIGHT : 'auto' }}>
								<HallMapInline
										eventId={eventId}
										hallType={activeHallTab}
										tables={tablesWithGuests}
										hallElements={hallElements}
										height={MAP_HEIGHT}
										availableCategories={availableCategories}
										canEditCategories={!isViewer}
										onChangeTableCategory={handleChangeTableCategory}
										onDropCategory={(table, category) => handleDropCategory(table, category)}
										onDropGuestToTable={(table, guest) => handleDropGuest(table, guest)}
										onAddSeat={handleAddSeatToTable}
										onRemoveSeat={handleRemoveSeatFromTable}
									/>
							</div>
							{sideBySide && hallImageDataUrl && showHallImage && !isNarrow && (
								<div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', height: IMAGE_HEIGHT }}>
									<img src={hallImageDataUrl} alt="תמונת אולם" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
								</div>
							)}
						</div>
          </div>
        </div>
      )}
      
 			{/* הסרתי את המפה הישנה (כרטיסים של שולחנות) ואת כפתור המודאל */}
 
 			{false && showHallMap && (
 				<HallMapOverlay eventId={eventId} hallType={activeHallTab} tables={tables} onClose={() => setShowHallMap(false)} />
 			)}
 
			{/* תמונת אולם מתחת למפה (כאשר לא זה-לצד-זה) */}
			<div style={{ marginTop: 24 }}>
				<h3 style={{ 
					fontSize: 18, 
					fontWeight: 700, 
					marginBottom: 16, 
					textAlign: 'center',
					color: '#09b0cb',
					fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
				}}>תמונת אולם</h3>
				<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
					<input id="hall-image-upload" type="file" accept="image/*" onChange={handleHallImageUpload} style={{ display: 'none' }} />
					<label 
						htmlFor="hall-image-upload" 
						style={{ 
							padding: '12px 28px', 
							background: 'linear-gradient(135deg, #09b0cb, #0bc4e0)',
							color: '#fff', 
							borderRadius: '999px', 
							cursor: 'pointer',
							fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
							fontSize: 15,
							fontWeight: 600,
							boxShadow: '0 4px 12px rgba(9, 176, 203, 0.3)',
							transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
							border: 'none',
							display: 'inline-block'
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.transform = 'translateY(-2px)';
							e.currentTarget.style.boxShadow = '0 6px 16px rgba(9, 176, 203, 0.4)';
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = 'translateY(0)';
							e.currentTarget.style.boxShadow = '0 4px 12px rgba(9, 176, 203, 0.3)';
						}}
					>
						בחר תמונה
					</label>
					{hallImageDataUrl && (
						<button 
							onClick={handleRemoveHallImage} 
							style={{ 
								padding: '12px 28px', 
								background: 'linear-gradient(135deg, #ef4444, #dc2626)',
								color: '#fff', 
								border: 'none', 
								borderRadius: '999px', 
								cursor: 'pointer',
								fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
								fontSize: 15,
								fontWeight: 600,
								boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
								transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.transform = 'translateY(-2px)';
								e.currentTarget.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.transform = 'translateY(0)';
								e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
							}}
						>
							הסר תמונה
						</button>
					)}
				</div>
				{(!sideBySide || isNarrow) && hallImageDataUrl && showHallImage && (
					<div style={{ display: 'flex', justifyContent: 'center' }}>
						<img src={hallImageDataUrl} alt="תמונת אולם" style={{ maxWidth: '100%', maxHeight: '75vh', width: 'auto', height: 'auto', objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 8 }} />
					</div>
				)}
			</div>
    </div>
  );
}
