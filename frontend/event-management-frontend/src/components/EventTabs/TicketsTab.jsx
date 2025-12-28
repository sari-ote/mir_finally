// TicketsTab.jsx - קוד מתוקן ללא שגיאות
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import "../../styles/theme-tropical.css";

export default function TicketsTab({ eventId }) {
  // במקום לוגו + תבנית נשתמש בקובץ כרטיס אחד שישמש כרקע קבוע
  const [cardTemplateFile, setCardTemplateFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportMenuPos, setExportMenuPos] = useState({ top: 0, left: 0 });
  const [lastPreset, setLastPreset] = useState('all');
  const exportMenuRef = useRef(null);
  const [showMapMenu, setShowMapMenu] = useState(false);
  const [mapMenuPos, setMapMenuPos] = useState({ top: 0, left: 0 });
  const [lastMapGender, setLastMapGender] = useState('male'); // 'male' | 'female'
  const mapMenuRef = useRef(null);

  // פונקציות לכרטיסים
  const handleCreateSeatingCards = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      
      const formData = new FormData();
      // נשלח את קובץ הכרטיס בתור template_file כדי להמשיך להשתמש ב-API הקיים
      if (cardTemplateFile) {
        formData.append('template_file', cardTemplateFile);
      }
      
      formData.append('force_recreate', 'true');
      
      const response = await fetch(`http://localhost:8001/seatings/generate-cards/${eventId}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}` 
        },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`נוצרו ${data.cards?.length || 0} כרטיסי ישיבה בהצלחה!`);
      } else {
        const error = await response.json();
        alert(`שגיאה ביצירת כרטיסי ישיבה: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error creating seating cards:', error);
      alert('שגיאה ביצירת כרטיסי ישיבה');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSeatingCards = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8001/seatings/cards/${eventId}/download-all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `כרטיסי_ישיבה_אירוע_${eventId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        alert("כרטיסי ישיבה הורדו בהצלחה!");
      } else {
        const error = await response.json();
        alert(`שגיאה בהורדת כרטיסי ישיבה: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error downloading seating cards:', error);
      alert('שגיאה בהורדת כרטיסי ישיבה');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSeatingCards = async () => {
    if (!window.confirm("האם אתה בטוח שברצונך למחוק את כל כרטיסי הישיבה הקיימים?")) {
      return;
    }
    
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8001/seatings/cards/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(data.message);
      } else {
        const error = await response.json();
        alert(`שגיאה במחיקת כרטיסי ישיבה: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error deleting seating cards:', error);
      alert('שגיאה במחיקת כרטיסי ישיבה');
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`http://localhost:8001/guests/export?event_id=${eventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `guests-${eventId}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('שגיאה ביצוא לאקסל');
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('שגיאה ביצוא לאקסל');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcelWithPreset = async (preset) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      // מפה בין preset לפרמטרים
      const presetToParams = {
        all: {},
        confirmed: { confirmed_only: 'true' },
        not_confirmed: { confirmed_only: 'false' },
        male: { gender: 'male' },
        female: { gender: 'female' },
        female_confirmed: { gender: 'female', confirmed_only: 'true' },
        male_confirmed: { gender: 'male', confirmed_only: 'true' },
        female_not_confirmed: { gender: 'female', confirmed_only: 'false' },
        male_not_confirmed: { gender: 'male', confirmed_only: 'false' }
      };
      const params = presetToParams[preset] || {};

      // בניית URL עם פרמטרים
      let url = `http://localhost:8001/guests/export?event_id=${eventId}`;
      if (params.gender) url += `&gender=${params.gender}`;
      if (params.confirmed_only) url += `&confirmed_only=${params.confirmed_only}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = (() => {
          switch (preset) {
            case 'confirmed': return `guests-${eventId}-confirmed.xlsx`;
            case 'not_confirmed': return `guests-${eventId}-not-confirmed.xlsx`;
            case 'male': return `guests-${eventId}-male.xlsx`;
            case 'female': return `guests-${eventId}-female.xlsx`;
            case 'female_confirmed': return `guests-${eventId}-female-confirmed.xlsx`;
            case 'male_confirmed': return `guests-${eventId}-male-confirmed.xlsx`;
            case 'female_not_confirmed': return `guests-${eventId}-female-not-confirmed.xlsx`;
            case 'male_not_confirmed': return `guests-${eventId}-male-not-confirmed.xlsx`;
            default: return `guests-${eventId}.xlsx`;
          }
        })();
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('שגיאה ביצוא לאקסל');
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('שגיאה ביצוא לאקסל');
    } finally {
      setLoading(false);
      setShowExportMenu(false);
    }
  };

  const handleExportSeatingImage = async (genderPreset = 'male') => {
    try {
      setLoading(true);
      // קביעת מגדר לפי הפריסט שנבחר
      let gender = null;
      let onlyEmptyTables = false;
      if (genderPreset.includes('|only_empty') || genderPreset.includes('|only_available')) {
        const [g] = genderPreset.split('|');
        gender = g;
        onlyEmptyTables = genderPreset.includes('|only_empty');
        var onlyAvailableTables = genderPreset.includes('|only_available');
      } else {
        if (genderPreset === 'male') gender = 'male';
        if (genderPreset === 'female') gender = 'female';
      }
      
      // ברירת מחדל: כל המקומות (אפשר להרחיב בהמשך ל־preset נפרד)
      let showEmptySeats = true;
      let showOccupiedSeats = true;
      
      const token = localStorage.getItem('access_token');
      
      // בניית URL עם פרמטרים
      let url = `http://localhost:8001/guests/export-seating-image?event_id=${eventId}`;
      if (gender) {
        url += `&gender=${gender}`;
      }
      url += `&show_empty_seats=${showEmptySeats}`;
      url += `&show_occupied_seats=${showOccupiedSeats}`;
      if (onlyEmptyTables) {
        url += `&only_empty_tables=true`;
      }
      if (typeof onlyAvailableTables !== 'undefined' && onlyAvailableTables) {
        url += `&only_available_tables=true`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = `seating-map-${eventId}${gender ? `-${gender}` : ''}.png`;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('שגיאה ביצוא תמונה');
      }
    } catch (error) {
      console.error('Error exporting image:', error);
      alert('שגיאה ביצוא תמונה');
    } finally {
      setLoading(false);
    }
  };

  // טריגר להפעלת הבוט מטאב הכרטיסים (דמו)
  const handleTriggerBotFromTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');

      const response = await fetch(`http://localhost:8001/bot/event/${eventId}/trigger-from-tickets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ source: 'tickets_tab' })
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message || 'הטריגר לבוט נשלח בהצלחה (דמו)');
      } else {
        const error = await response.json();
        alert(error.detail || 'שגיאה בשליחת טריגר לבוט');
      }
    } catch (error) {
      console.error('Error triggering bot from tickets:', error);
      alert('שגיאה בשליחת טריגר לבוט');
    } finally {
      setLoading(false);
    }
  };

  // סגירת תפריט הייצוא בלחיצה מחוץ
  useEffect(() => {
    if (!showExportMenu) return;
    const onClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showExportMenu]);

  // סגירת תפריט מפת ישיבה בלחיצה מחוץ
  useEffect(() => {
    if (!showMapMenu) return;
    const onClickOutside = (e) => {
      if (mapMenuRef.current && !mapMenuRef.current.contains(e.target)) {
        setShowMapMenu(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showMapMenu]);

  // טעינת תבנית שמורה מהשרת
  useEffect(() => {
    const loadSavedTemplate = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://localhost:8001/seatings/get-template/${eventId}`, {
          headers: { 
            Authorization: `Bearer ${token}` 
          }
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const fileName = `template_${eventId}.png`;
          // יצירת File object מהקובץ שנטען
          const file = new File([blob], fileName, { type: blob.type || 'image/png' });
          setCardTemplateFile(file);
        } else if (response.status !== 404) {
          // רק אם זו לא שגיאת 404 (קובץ לא נמצא), נדפיס שגיאה
          console.error('Error loading saved template:', response.status);
        }
      } catch (error) {
        console.error('Error loading saved template:', error);
        // לא נציג שגיאה - פשוט לא נטען קובץ אם אין
      }
    };
    
    if (eventId) {
      loadSavedTemplate();
    }
  }, [eventId]);

  const handleCardTemplateUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setCardTemplateFile(file);
      
      // שמירת הקובץ מיד לשרת
      try {
        setLoading(true);
        const token = localStorage.getItem('access_token');
        const formData = new FormData();
        formData.append('template_file', file);
        
        const response = await fetch(`http://localhost:8001/seatings/save-template/${eventId}`, {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${token}` 
          },
          body: formData
        });
        
        if (response.ok) {
          alert('קובץ הכרטיס נשמר בהצלחה!');
        } else {
          const error = await response.json();
          console.error('Error saving template:', error);
          // לא נציג שגיאה למשתמש כי הקובץ כבר נבחר
        }
      } catch (error) {
        console.error('Error saving template file:', error);
        // לא נציג שגיאה למשתמש כי הקובץ כבר נבחר
      } finally {
        setLoading(false);
      }
    }
  };

  // עיצוב משופר לכפתורים
  const buttonStyle = {
    padding: "10px 16px",
    border: "none",
    borderRadius: "6px",
    color: "white",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "13px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    transition: "all 0.2s ease",
    minWidth: "140px",
    margin: "4px"
  };

  return (
    <div style={{ direction: "rtl", padding: "20px" }}>
      <h1 style={{ 
        textAlign: "center", 
        marginBottom: "40px", 
        color: "#09b0cb",
        fontSize: "32px",
        fontWeight: 700,
        fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        textShadow: "0 2px 4px rgba(9, 176, 203, 0.1)"
      }}>
        ניהול כרטיסים
      </h1>

      {/* אזור העלאת כרטיס יחיד שישמש כרקע לכרטיסים */}
      <div style={{
        marginBottom: "30px",
        textAlign: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
          <input
            type="file"
            accept="image/*"
            onChange={handleCardTemplateUpload}
            style={{ display: "none" }}
            id="card-template-upload"
          />
          <label
            htmlFor="card-template-upload"
            style={{
              padding: "12px 28px",
              background: "linear-gradient(135deg, #09b0cb, #0bc4e0)",
              color: "white",
              borderRadius: "999px",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: 600,
              fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              boxShadow: "0 4px 12px rgba(9, 176, 203, 0.3)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              border: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(9, 176, 203, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(9, 176, 203, 0.3)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            בחר קובץ לרקע הכרטיס
          </label>
          <span style={{ 
            color: cardTemplateFile ? "#09b0cb" : "#64748b", 
            fontSize: "14px",
            fontWeight: cardTemplateFile ? 600 : 400,
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}>
            {cardTemplateFile ? cardTemplateFile.name : "לא נבחר כרטיס, אנא עלה קובץ"}
          </span>
        </div>
      </div>

      {/* כפתורי פעולה - עיצוב משופר ומרוכז */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        marginBottom: "25px",
        justifyContent: "center",
        maxWidth: "800px",
        margin: "0 auto 25px auto"
      }}>
        <button
          onClick={handleCreateSeatingCards}
          disabled={loading}
          className="tropical-button-primary"
          style={{
            minWidth: "140px",
            margin: "4px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          יצירת כרטיסי ישיבה
        </button>

        <button
          onClick={handleDownloadSeatingCards}
          disabled={loading}
          className="tropical-button-primary"
          style={{
            minWidth: "140px",
            margin: "4px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          הורדת כרטיסי ישיבה
        </button>

        <button
          onClick={handleDeleteSeatingCards}
          disabled={loading}
          className="tropical-button-primary"
          style={{
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            minWidth: "140px",
            margin: "4px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          מחיקת כרטיסי ישיבה
        </button>

        {/* כפתור יחיד: פותח תפריט ייצוא אקסל */}
        <button
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setExportMenuPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX - 140 });
            setShowExportMenu((v) => !v);
          }}
          disabled={loading}
          className="tropical-button-secondary"
          style={{
            minWidth: "140px",
            margin: "4px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          יצוא לאקסל
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <button
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setMapMenuPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX - 140 });
            setShowMapMenu((v) => !v);
          }}
          disabled={loading}
          className="tropical-button-secondary"
          style={{
            minWidth: "140px",
            margin: "4px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          יצוא תמונה מפת ישיבה
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {/* טריגר להפעלת הבוט - דמו */}
        <button
          onClick={handleTriggerBotFromTickets}
          disabled={loading}
          className="tropical-button-primary"
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            minWidth: "140px",
            margin: "4px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          הפעלת בוט מהכרטיסים (דמו)
        </button>
      </div>

      {loading && (
        <div style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "20px",
          borderRadius: "8px",
          zIndex: 1000,
          fontSize: "16px"
        }}>
          טוען...
        </div>
      )}

      {/* תפריט בחירת ייצוא (צף) */}
      {showExportMenu && (
        <div
          style={{
            position: 'absolute',
            top: exportMenuPos.top,
            left: exportMenuPos.left,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.12)',
            zIndex: 1000,
            minWidth: 240,
            padding: 8,
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}
          ref={exportMenuRef}
        >
          {[
            { key: 'all', label: 'כל המוזמנים' },
            { key: 'confirmed', label: 'מאושרי הגעה בלבד' },
            { key: 'not_confirmed', label: 'לא אישרו הגעה' },
            { key: 'male', label: 'גברים בלבד' },
            { key: 'female', label: 'נשים בלבד' },
            { key: 'female_confirmed', label: 'נשים מאושרות הגעה' },
            { key: 'male_confirmed', label: 'גברים מאושרי הגעה' },
            { key: 'female_not_confirmed', label: 'נשים שלא אישרו הגעה' },
            { key: 'male_not_confirmed', label: 'גברים שלא אישרו הגעה' }
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => { setLastPreset(opt.key); handleExportExcelWithPreset(opt.key); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'right',
                background: 'transparent',
                border: 'none',
                padding: '12px 16px',
                cursor: 'pointer',
                borderRadius: 12,
                fontSize: '14px',
                fontWeight: 500,
                color: '#10131A',
                transition: 'all 0.2s ease',
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(9, 176, 203, 0.1)';
                e.currentTarget.style.color = '#09b0cb';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#10131A';
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* תפריט בחירת מגדר לתמונת המפה (צף) */}
      {showMapMenu && (
        <div
          style={{
            position: 'absolute',
            top: mapMenuPos.top,
            left: mapMenuPos.left,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: 16,
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.12)',
            zIndex: 1000,
            minWidth: 240,
            padding: 8,
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}
          ref={mapMenuRef}
        >
          {[
            { key: 'male', label: 'מפת ישיבה - גברים' },
            { key: 'female', label: 'מפת ישיבה - נשים' },
            { key: 'male_empty', label: 'מפת ישיבה - שולחנות פנויים (גברים)' },
            { key: 'female_empty', label: 'מפת ישיבה - שולחנות פנויים (נשים)' }
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => {
                setLastMapGender(opt.key.includes('female') ? 'female' : 'male');
                const gender = opt.key.includes('female') ? 'female' : 'male';
                const onlyEmpty = opt.key.endsWith('_empty');
                const onlyAvailable = opt.key.endsWith('_available');
                let payload = gender;
                if (onlyEmpty) payload = `${gender}|only_empty`;
                if (onlyAvailable) payload = `${gender}|only_available`;
                handleExportSeatingImage(payload);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'right',
                background: 'transparent',
                border: 'none',
                padding: '12px 16px',
                cursor: 'pointer',
                borderRadius: 12,
                fontSize: '14px',
                fontWeight: 500,
                color: '#10131A',
                transition: 'all 0.2s ease',
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(9, 176, 203, 0.1)';
                e.currentTarget.style.color = '#09b0cb';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#10131A';
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}