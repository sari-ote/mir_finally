import React, { useState, useEffect, useCallback, useRef } from 'react';
import TableVisual from '../TableVisual.jsx';
import { useParams } from "react-router-dom";
import "../../styles/theme-tropical.css";
import { HALL_ELEMENT_ORDER, getHallElementConfig } from '../hallElementTypes';

export default function EventSettingsTab({ eventId }) {
  console.log('EventSettingsTab: eventId from props:', eventId);
  console.log('EventSettingsTab: eventId type:', typeof eventId);
  console.log('EventSettingsTab: eventId value:', eventId);
  const [activeHallTab, setActiveHallTab] = useState('m'); // התחל עם אולם גברים
  const [tableTypes, setTableTypes] = useState([]);
  const [newTable, setNewTable] = useState({ size: "", count: "", shape: "circular" });
  const [showMap, setShowMap] = useState(false);
  const [tablePositions, setTablePositions] = useState([]);
  const [tables, setTables] = useState([]); // raw tables from server
  const [availableCategories, setAvailableCategories] = useState([]); // categories per hall
  const [tableCategories, setTableCategories] = useState([]); // by index
  const [hoveredTableIdx, setHoveredTableIdx] = useState(null); // הצגת בחירת קטגוריה רק בהובר
  
  // HallElement state
  const [hallElements, setHallElements] = useState([]);
  const [newHallElement, setNewHallElement] = useState({ 
    name: "", 
    element_type: "stage", 
    width: "", 
    height: "" 
  });
  const [showProMessage, setShowProMessage] = useState(false); // הודעת שדרוג ל-PRO
  
  // אלמנטים פתוחים (רק במה וכניסה) - השאר נעולים ל-PRO
  const FREE_ELEMENT_TYPES = ['stage', 'entrance'];
  
  // Drag and drop state for all elements
  const [draggedElement, setDraggedElement] = useState(null);
  const [draggedElementType, setDraggedElementType] = useState(null); // 'table' or 'hall_element'
  const [draggedElementId, setDraggedElementId] = useState(null);
  
  // Resize and rotate state for hall elements
  const [resizingElement, setResizingElement] = useState(null);
  const [rotatingElement, setRotatingElement] = useState(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, zoomAtStart: 1 });
  const [rotateStart, setRotateStart] = useState({ x: 0, y: 0, angle: 0 });

  const resolveHallElementDefaults = useCallback((type) => {
    const cfg = getHallElementConfig(type);
    const isStageFamily = cfg.family === 'stage';

    return {
      width: cfg.width || (isStageFamily ? 1200 : 300),
      height: cfg.height || (isStageFamily ? 200 : 120),
      x: isStageFamily ? 50 : 80,
      y: isStageFamily ? 20 : 80,
      color: cfg.color || '#94a3b8',
      label: cfg.label || 'אלמנט',
    };
  }, []);

  const generateHallElementName = useCallback((type) => {
    const cfg = getHallElementConfig(type);
    const base = cfg.label || 'אלמנט';
    const countSameType = hallElements.filter(e => e.element_type === type).length;
    return countSameType ? `${base} ${countSameType + 1}` : base;
  }, [hallElements]);
  const [hoveredHallElementId, setHoveredHallElementId] = useState(null);
  const hoverTimeoutRef = useRef(null);
  
  const dragInfo = useRef({ idx: null, offsetX: 0, offsetY: 0 });
  const draggedElementIdRef = useRef(null); // שמירת ה-ID של האלמנט הנגרר
  const mapRef = useRef(null); // ref לקונטיינר של מפת האולם לחישובי מיקום מדויקים
  const [zoom, setZoom] = useState(1); // זום המפה
  const [pan, setPan] = useState({ x: 0, y: 0 }); // הזזה של כל המפה
  const panInfo = useRef({ isPanning: false, startMouseX: 0, startMouseY: 0, startPanX: 0, startPanY: 0 });
  const [loading, setLoading] = useState(true);
  const role = localStorage.getItem("role");
  // צופה יכול להישמר גם באנגלית ("viewer") וגם בעברית ("צופה")
  const isViewer = role === "viewer" || role === "צופה";
  const [permissionMessage, setPermissionMessage] = useState("");

  // הודעת הרשאות שנעלמת אחרי כמה שניות
  useEffect(() => {
    if (!permissionMessage) return;
    const t = setTimeout(() => setPermissionMessage(""), 3000);
    return () => clearTimeout(t);
  }, [permissionMessage]);

  const showNoPermission = () => {
    setPermissionMessage("אין לך את ההרשאות לפעולה זו");
  };

  // משתנה עזר גלובלי: כל השולחנות (לפי סוגים וכמות)
  const allTables = tableTypes.flatMap(t => Array(Number(t.count)).fill({ size: Number(t.size), shape: t.shape }));
  const tablesForRender = tables.length > 0 ? tables.map(t => ({ size: Number(t.size), shape: t.shape })) : allTables;
  
  // פונקציות שליטה בזום
  const setZoomSafe = (val) => {
    const clamped = Math.min(3, Math.max(0.3, Number(val)));
    setZoom(Number(clamped.toFixed(2)));
  };
  const handleZoomIn = () => setZoomSafe(zoom + 0.1);
  const handleZoomOut = () => setZoomSafe(zoom - 0.1);
  const handleWheelZoom = (e) => {
    if (!e.ctrlKey && !e.metaKey) return; // זום רק עם Ctrl/⌘ כדי לא להפריע לגלילה רגילה
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoomSafe(zoom + delta);
  };
  const handleMapMouseDown = (e) => {
    // התחלת פאן כשנלחץ על הרקע של המפה
    if (e.target === mapRef.current && !isViewer) {
      panInfo.current = {
        isPanning: true,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      document.addEventListener('mousemove', handleMapMouseMove);
      document.addEventListener('mouseup', handleMapMouseUp);
    }
  };
  const handleMapMouseMove = (e) => {
    if (!panInfo.current.isPanning) return;
    const dx = e.clientX - panInfo.current.startMouseX;
    const dy = e.clientY - panInfo.current.startMouseY;
    setPan({ x: panInfo.current.startPanX + dx, y: panInfo.current.startPanY + dy });
  };
  const handleMapMouseUp = () => {
    panInfo.current.isPanning = false;
    document.removeEventListener('mousemove', handleMapMouseMove);
    document.removeEventListener('mouseup', handleMapMouseUp);
  };

  // התאמת זום ופאן כך שכל השולחנות יהיו מוצגים בתוך המפה
  const fitMapToTables = useCallback(() => {
    try {
      if (!mapRef.current) return;
      if (!tablesForRender || tablesForRender.length === 0) return;

      const containerWidth = mapRef.current.clientWidth || 1;
      const containerHeight = mapRef.current.clientHeight || 1;

      // גבולות השולחנות בעולם המפה (world coords)
      const margin = 80; // שוליים מסביב
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      tablesForRender.forEach((_, idx) => {
        const pos = tablePositions[idx] || { x: 40 + (idx % 10) * 140, y: 40 + Math.floor(idx / 10) * 140 };
        const x = pos.x || 0;
        const y = pos.y || 0;
        const w = 120;
        const h = 120;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      });

      if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return;

      const worldWidth = maxX - minX + margin * 2;
      const worldHeight = maxY - minY + margin * 2;

      // חישוב זום כך שהכל ייכנס
      const zoomX = containerWidth / worldWidth;
      const zoomY = containerHeight / worldHeight;
      const targetZoom = Math.min(zoomX, zoomY, 1.5); // לא לעבור זום 150%

      // מרכז המלבן של השולחנות
      const centerX = minX + (maxX - minX) / 2;
      const centerY = minY + (maxY - minY) / 2;

      // נרצה שהמרכז יישב באמצע הקונטיינר אחרי transform
      const newPanX = containerWidth / 2 - centerX * targetZoom;
      const newPanY = containerHeight / 2 - centerY * targetZoom;

      setZoomSafe(targetZoom);
      setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
    } catch (e) {
      console.error('Error in fitMapToTables:', e);
    }
  }, [tablesForRender, tablePositions]);

  console.log('🎭 Current role:', role);
  console.log('🎭 Is viewer:', isViewer);
  console.log('🎭 Can drag elements:', !isViewer);

  // טעינה ראשונית פשוטה
  useEffect(() => {
    console.log('🎭 loadInitialData useEffect triggered');
    console.log('🎭 Event ID:', eventId, 'Hall type:', activeHallTab);
    console.log('🎭 Event ID type:', typeof eventId);
    console.log('🎭 Event ID value:', eventId);
    
    // בדיקה אם eventId קיים
    if (!eventId) {
      console.log('🎭 No eventId, skipping loadInitialData');
      return;
    }
    
    const loadInitialData = async () => {
      try {
        console.log('🎭 Starting loadInitialData...');
        const token = localStorage.getItem('access_token');
        console.log('🎭 Token exists:', !!token);
        
        const url = `http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`;
        console.log('🎭 Fetching from URL:', url);
        
        const res = await fetch(url, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        console.log('🎭 Response status:', res.status, 'OK:', res.ok);
        
        if (res.ok) {
          const data = await res.json();
          console.log('Initial load - Fetched tables:', data);
          console.log('Initial load - Number of tables:', data.length);
          console.log('Initial load - Event ID:', eventId);
          console.log('Initial load - Hall type:', activeHallTab);
          
          // Debug each table
          data.forEach((table, index) => {
            console.log(`Table ${index + 1}:`, {
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
          
          setTables(Array.isArray(data) ? data : []);
          setTableCategories((Array.isArray(data) ? data : []).map(t => t.category || ''));
          
          // קיבוץ לפי size ו-shape
          const typeMap = {};
          data.forEach(t => {
            console.log('Processing table for typeMap:', t);
            
            // Handle null/undefined size by using a default value instead of skipping
            let tableSize = t.size;
            if (tableSize === null || tableSize === undefined || isNaN(Number(tableSize))) {
              console.warn('Table has invalid size, using default size 4:', t);
              tableSize = 4; // Use default size instead of skipping
            }
            
            const key = `${tableSize}_${t.shape || 'circular'}`;
            if (!typeMap[key]) typeMap[key] = { size: Number(tableSize), count: 0, shape: t.shape || 'circular' };
            typeMap[key].count++;
          });
          const types = Object.values(typeMap);
          console.log('Initial load - Grouped table types:', types);
          setTableTypes(types);
          
          // טען מיקומים
          const serverPositions = data.map(t => ({ x: t.x, y: t.y }));
          
          // בדיקה אם המיקומים מהשרת ריקים או לא מסודרים - אם כן, נשתמש בחישוב אוטומטי
          const hasValidPositions = serverPositions.every(pos => pos.x && pos.y && pos.x > 0 && pos.y > 0);
          
          if (!hasValidPositions) {
            console.log('Server positions are invalid, using auto layout');
            setTablePositions(computeAutoLayout(data.length));
          } else {
            setTablePositions(serverPositions);
          }
        } else {
          console.log('🎭 Response not OK:', res.status, res.statusText);
        }
      } catch (error) {
        console.error('Error in initial load:', error);
      }
    };
    
    loadInitialData();
  }, [eventId, activeHallTab]);

  // טען אלמנטי אולם
  useEffect(() => {
    console.log('🎭🎭🎭 Hall elements useEffect STARTED - eventId:', eventId, 'activeHallTab:', activeHallTab);
    async function fetchHallElements() {
      try {
        console.log('Fetching hall elements for event:', eventId, 'hall type:', activeHallTab);
        const token = localStorage.getItem('access_token');
        const url = `http://localhost:8001/tables/hall-elements/event/${eventId}?hall_type=${activeHallTab}`;
        console.log('Fetching from URL:', url);
        
        // בדיקה פשוטה אם השרת רץ
        try {
          const healthCheck = await fetch('http://localhost:8001/docs', { method: 'GET' });
          console.log('Backend health check status:', healthCheck.status);
        } catch (healthError) {
          console.error('Backend health check failed:', healthError);
        }
        
        const res = await fetch(url, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        console.log('Hall elements response status:', res.status);
        console.log('Hall elements response ok:', res.ok);
        
        if (res.ok) {
          const data = await res.json();
          console.log('🎭 Fetched hall elements from server:', data);
          console.log('🎭 Stage dimensions from server:', data.filter(el => el.element_type === 'stage').map(el => ({ id: el.id, width: el.width, height: el.height, x: el.x, y: el.y })));
          console.log('🎭 All hall elements details:', data.map(el => ({ id: el.id, type: el.element_type, width: el.width, height: el.height, x: el.x, y: el.y })));
          
          // סנן אלמנטים ללא id תקין
          const validElements = data.filter(el => el.id !== undefined && el.id !== null && !Number.isNaN(Number(el.id)));
          if (validElements.length !== data.length) {
            console.warn('⚠️ Some hall elements are missing valid IDs:', data.filter(el => !el.id || el.id === undefined || el.id === null || Number.isNaN(Number(el.id))));
          }
          
          // השתמש בנתונים מהשרת ישירות (לא מ-localStorage)
          console.log('🎭 Using hall elements from server:', validElements);
          setHallElements(validElements);
        } else {
          console.error('Failed to fetch hall elements. Status:', res.status);
          const errorText = await res.text();
          console.error('Error response:', errorText);
        }
      } catch (error) {
        console.error('Error fetching hall elements:', error);
      }
    }
    fetchHallElements();
  }, [eventId, activeHallTab]);

  // שמירה אוטומטית לשרת בכל שינוי
  useEffect(() => {
    if (loading) return;
    
    // אל תנסה לשמור אם אין שולחנות
    if (tableTypes.length === 0) return;
    
    // אל תנסה לשמור בזמן גרירה פעילה
    if (draggedElementType !== null) {
      console.log('Skipping save - active dragging in progress');
      return;
    }
    
    // מניעת שמירה כפולה
    const saveKey = JSON.stringify({ tableTypes, tablePositions, activeHallTab });
    console.log('=== SAVE PREVENTION DEBUG ===');
    console.log('Current saveKey:', saveKey);
    console.log('Last saveKey:', window.lastSaveKey);
    console.log('Keys match:', window.lastSaveKey === saveKey);
    
    if (window.lastSaveKey === saveKey) {
      console.log('Skipping save - same data already saved');
      return;
    }
    
    console.log('Proceeding with save...');
    
    const saveTables = async () => {
      try {
        // בדיקת תקינות הנתונים לפני שליחה
        console.log('=== DEBUG INFO ===');
        console.log('Current Hall Type:', activeHallTab);
        console.log('Event ID:', eventId);
        console.log('Table Types:', tableTypes);
        console.log('Table Positions:', tablePositions);
        console.log('Loading State:', loading);
        
        // בדוק אם יש שולחנות קיימים
        const token = localStorage.getItem('access_token');
        const existingTablesResponse = await fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const existingTables = await existingTablesResponse.json();
        
        // בדוק אם יש שינוי משמעותי
        const currentTableConfig = tableTypes.map(t => ({ size: t.size, count: t.count }));
        const existingTableConfig = [];
        
        // יצירת קונפיגורציה מהשולחנות הקיימים
        const sizeCount = {};
        existingTables.forEach(table => {
          sizeCount[table.size] = (sizeCount[table.size] || 0) + 1;
        });
        Object.entries(sizeCount).forEach(([size, count]) => {
          existingTableConfig.push({ size: parseInt(size), count });
        });
        
        // השוואה בין הקונפיגורציות
        const configChanged = JSON.stringify(currentTableConfig.sort()) !== JSON.stringify(existingTableConfig.sort());
        
        // בדוק אם יש שינוי במיקומים
        const positionsChanged = existingTables.length !== tablePositions.length || 
          existingTables.some((table, index) => {
            const currentPos = tablePositions[index];
            return !currentPos || table.x !== currentPos.x || table.y !== currentPos.y;
          });
        
        // בדוק אם יש שינוי בקטגוריות
        const categoriesChanged = existingTables.length !== tableCategories.length ||
          existingTables.some((table, index) => {
            const curr = (tableCategories[index] || '');
            const prev = (table.category || '');
            return curr !== prev;
          });
        
        console.log('Current config:', currentTableConfig);
        console.log('Existing config:', existingTableConfig);
        console.log('Config changed:', configChanged);
        console.log('Positions changed:', positionsChanged);
        console.log('Categories changed:', categoriesChanged);
        
        // אם אין שינוי משמעותי ואין שינוי במיקומים ואין שינוי בקטגוריות, אל תשלח בקשה
        if (!configChanged && !positionsChanged && !categoriesChanged && existingTables.length > 0) {
          console.log('No significant change detected, skipping save');
          return;
        }
        
        // בדוק אם זה שינוי קטן (הוספה או מחיקה של שולחן אחד)
        // במקום לבדוק רק את הסכום הכולל, נבדוק אם רק סוג אחד השתנה ב-+1 או -1
        let changedTypes = [];
        let isSmallChange = false;
        
        // בדוק איזה סוגים השתנו
        currentTableConfig.forEach(current => {
          const existing = existingTableConfig.find(e => e.size === current.size);
          if (!existing) {
            // סוג חדש שנוסף
            changedTypes.push({ type: 'add', size: current.size, count: current.count });
          } else if (existing.count !== current.count) {
            // סוג קיים שהשתנה
            changedTypes.push({ 
              type: 'change', 
              size: current.size, 
              oldCount: existing.count, 
              newCount: current.count 
            });
          }
        });
        
        // בדוק איזה סוגים נמחקו
        existingTableConfig.forEach(existing => {
          const current = currentTableConfig.find(c => c.size === existing.size);
          if (!current) {
            // סוג שנמחק
            changedTypes.push({ type: 'remove', size: existing.size, count: existing.count });
          }
        });
        
        console.log('Current table config:', currentTableConfig);
        console.log('Existing table config:', existingTableConfig);
        console.log('Changed types:', changedTypes);
        
        // בדוק אם זה שינוי קטן (רק סוג אחד השתנה ב-+1 או -1)
        if (changedTypes.length === 1) {
          const change = changedTypes[0];
          if (change.type === 'add' || change.type === 'remove') {
            // שינוי קטן רק אם מוסיפים/מסירים שולחן אחד בדיוק
            isSmallChange = Number(change.count) === 1;
          } else if (change.type === 'change') {
            // שינוי בכמות של סוג קיים
            const diff = Math.abs(change.newCount - change.oldCount);
            isSmallChange = diff === 1;
          }
        }
        
        // אם יש שינוי קטן, תמיד תשלח add-single/remove-single
        if (isSmallChange && !positionsChanged) {
          console.log('Processing as small change');
          // טיפול בשינוי קטן - הוספה או מחיקה של שולחן אחד
          const change = changedTypes[0];
          
          if (change.type === 'add' || (change.type === 'change' && change.newCount > change.oldCount)) {
            console.log('Adding one table');
            // הוספת שולחן אחד
            const inferredShape = (tableTypes.find(t => Number(t.size) === Number(change.size))?.shape) || 'circular';
            const calcX = 40 + (existingTables.length % 10) * 140;
            const calcY = 40 + Math.floor(existingTables.length / 10) * 140;
            const nextTableNumber = (existingTables.length > 0)
              ? Math.max(...existingTables.map(t => Number(t.table_number) || 0)) + 1
              : 1;
            const newTable = {
              event_id: Number(eventId),
              table_number: Number(nextTableNumber),
              size: Number(change.size),
              shape: inferredShape,
              x: Math.round(calcX),
              y: Math.round(calcY),
              table_head: null,
              category: null,
              hall_type: activeHallTab,
            };
            
            console.log('Adding single table:', newTable);
            
            const response = await fetch(`http://localhost:8001/tables/event/${eventId}/add-single`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify(newTable),
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('Add-single server error:', errorText);
              alert(`שגיאה בהוספת שולחן: ${response.status} - ${errorText}`);
              // סנכרון מחדש כדי לא להשאיר UI שונה מהשרת
              try {
                const resSync = await fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
                  headers: { "Authorization": `Bearer ${token}` }
                });
                if (resSync.ok) {
                  const dataSync = await resSync.json();
                  const typeMapSync = {};
                  dataSync.forEach(t => {
                    const key = `${t.size}_${t.shape || 'circular'}`;
                    if (!typeMapSync[key]) typeMapSync[key] = { size: t.size, count: 0, shape: t.shape || 'circular' };
                    typeMapSync[key].count++;
                  });
                  setTables(Array.isArray(dataSync) ? dataSync : []);
                  setTableTypes(Object.values(typeMapSync));
                }
              } catch (e) {
                console.error('Resync after add-single failure failed:', e);
              }
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Single table added successfully:', data);
            // סנכרון מצב מהשרת אחרי הצלחה
            try {
              const resSync = await fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
                headers: { "Authorization": `Bearer ${token}` }
              });
              if (resSync.ok) {
                const dataSync = await resSync.json();
                setTables(Array.isArray(dataSync) ? dataSync : []);
                const typeMapSync = {};
                dataSync.forEach(t => {
                  // Handle null/undefined size by using a default value instead of skipping
                  let tableSize = t.size;
                  if (tableSize === null || tableSize === undefined || isNaN(Number(tableSize))) {
                    console.warn('Table has invalid size during sync, using default size 4:', t);
                    tableSize = 4; // Use default size instead of skipping
                  }
                  const key = `${tableSize}_${t.shape || 'circular'}`;
                  if (!typeMapSync[key]) typeMapSync[key] = { size: Number(tableSize), count: 0, shape: t.shape || 'circular' };
                  typeMapSync[key].count++;
                });
                setTableTypes(Object.values(typeMapSync));
                const serverPositions = dataSync.map(t => ({ x: t.x, y: t.y }));
                setTablePositions(serverPositions);
              }
            } catch (e) {
              console.error('Resync after add-single success failed:', e);
            }
          } else if (change.type === 'remove' || (change.type === 'change' && change.newCount < change.oldCount)) {
            console.log('Removing one table');
            // מחיקת שולחן אחד
            const tableToRemove = existingTables.find(t => t.size === change.size);
            if (tableToRemove) {
              const response = await fetch(`http://localhost:8001/tables/${tableToRemove.id}`, {
                method: "DELETE",
                headers: { 
                  "Authorization": `Bearer ${token}`
                }
              });
              
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              
              const data = await response.json();
              console.log('Single table removed successfully:', data);
              // סנכרון מצב מהשרת אחרי הצלחה
              try {
                const resSync = await fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
                  headers: { "Authorization": `Bearer ${token}` }
                });
                if (resSync.ok) {
                  const dataSync = await resSync.json();
                  setTables(Array.isArray(dataSync) ? dataSync : []);
                  const typeMapSync = {};
                  dataSync.forEach(t => {
                    const key = `${t.size}_${t.shape || 'circular'}`;
                    if (!typeMapSync[key]) typeMapSync[key] = { size: t.size, count: 0, shape: t.shape || 'circular' };
                    typeMapSync[key].count++;
                  });
                  setTableTypes(Object.values(typeMapSync));
                  const serverPositions = dataSync.map(t => ({ x: t.x, y: t.y }));
                  setTablePositions(serverPositions);
                }
              } catch (e) {
                console.error('Resync after remove-single success failed:', e);
              }
            }
          }
        } else {
          console.log('Processing as bulk change - simple approach');
          // שינוי גדול - שלח את כל השולחנות
          const tablesPayload = [];
          let tableIndex = 0;
          
          // יצירת שולחנות לפי סוגים וכמות
          tableTypes.forEach(tableType => {
            const tableSize = Number(tableType.size);
            const tableCount = Number(tableType.count);
            
            if (isNaN(tableSize) || isNaN(tableCount) || tableSize < 1 || tableCount < 1) {
              console.error('Invalid table type data:', tableType);
              throw new Error(`Invalid table type: size=${tableType.size}, count=${tableType.count}`);
            }
            
            for (let i = 0; i < tableCount; i++) {
              const savedPosition = tablePositions[tableIndex];
              let x, y;
              
              if (savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
                x = savedPosition.x;
                y = savedPosition.y;
              } else {
                x = 40 + (tableIndex % 6) * 120;
                y = 40 + Math.floor(tableIndex / 6) * 120;
              }
              
              const tableData = {
                event_id: Number(eventId),
                table_number: tableIndex + 1,
                size: tableSize,
                shape: tableType.shape || 'circular',
                x: Math.round(x),
                y: Math.round(y),
                table_head: null,
                category: (tableCategories[tableIndex] || '') || null,
                hall_type: activeHallTab,
              };
              
              tablesPayload.push(tableData);
              tableIndex++;
            }
          });

          const url = `http://localhost:8001/tables/event/${eventId}/bulk?hall_type=${activeHallTab}`;
          console.log('Sending bulk request to:', url);
          console.log('Request body:', JSON.stringify(tablesPayload, null, 2));
          console.log('Event ID:', eventId);
          console.log('Hall type:', activeHallTab);
          console.log('Number of tables to save:', tablesPayload.length);

          const response = await fetch(url, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(tablesPayload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
          }

          const data = await response.json();
        }
        
        // שמור את המפתח של השמירה הנוכחית
        window.lastSaveKey = saveKey;
        
      } catch (error) {
        console.error('Error saving tables:', error);
        alert(`שגיאה בשמירת השולחנות: ${error.message}`);
        // סנכרון מחדש מהשרת כדי ליישר בין הפרונט לשרת
        try {
          const token = localStorage.getItem('access_token');
          const res = await fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const typeMap = {};
            data.forEach(t => {
              const key = `${t.size}_${t.shape || 'circular'}`;
              if (!typeMap[key]) typeMap[key] = { size: t.size, count: 0, shape: t.shape || 'circular' };
              typeMap[key].count++;
            });
            const types = Object.values(typeMap);
            setTableTypes(types);
            const serverPositions = data.map(t => ({ x: t.x, y: t.y }));
            setTablePositions(serverPositions);
            // נקה שמירה אחרונה כדי לא לחסום שמירות עתידיות
            window.lastSaveKey = null;
          }
        } catch (syncErr) {
          console.error('Failed to resync tables after error:', syncErr);
        }
      }
    };

    // הוסף השהייה קצרה לפני שמירה כדי למנוע שליחות מרובות
    const timeoutId = setTimeout(saveTables, 500);
    return () => clearTimeout(timeoutId);
  }, [tableTypes, tablePositions, activeHallTab, eventId, loading, tableCategories]);

  // שמירה אוטומטית של מיקומי השולחנות ב-localStorage
  useEffect(() => {
    if (tablePositions.length > 0 && !loading) {
      // עגל את כל המיקומים למספרים שלמים
      const roundedPositions = tablePositions.map(pos => ({
        x: Math.round(pos.x || 0),
        y: Math.round(pos.y || 0)
      }));
      
      const localStorageKey = `tablePositions_${eventId}_${activeHallTab}`;
      localStorage.setItem(localStorageKey, JSON.stringify(roundedPositions));
      console.log('Saved rounded table positions to localStorage:', roundedPositions);
    }
  }, [tablePositions, eventId, activeHallTab, loading]);

  // שמירה אוטומטית בשרת של כל שינוי באלמנטי האולם
  useEffect(() => {
    console.log('🎭 Save useEffect triggered:', { loading, hallElementsLength: hallElements.length, draggedElementType, resizingElement, rotatingElement });
    
    if (loading || hallElements.length === 0) {
      console.log('🎭 Skipping save - loading or no elements');
      return;
    }
    
    // אל תנסה לשמור בזמן גרירה פעילה
    if (draggedElementType === 'hall_element' || resizingElement || rotatingElement) {
      console.log('🎭 Skipping save - active manipulation in progress');
      return;
    }
    
    // מניעת שמירה כפולה
    const saveKey = JSON.stringify(hallElements.map(el => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation })));
    console.log('🎭 Hall elements save key:', saveKey);
    console.log('🎭 Last save key:', window.lastHallElementsSaveKey);
    
    if (window.lastHallElementsSaveKey === saveKey) {
      console.log('🎭 Skipping hall elements save - same data already saved');
      return;
    }
    
    console.log('🎭 Proceeding with hall elements save to server...');
    
    const saveHallElements = async () => {
      try {
        // שמור כל אלמנט בנפרד בשרת
        const token = localStorage.getItem('access_token');
        const savePromises = hallElements.map(async (element) => {
          const response = await fetch(`http://localhost:8001/tables/hall-elements/${element.id}`, {
            method: "PUT",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              x: Math.round(element.x || 0),
              y: Math.round(element.y || 0),
              width: Math.round(element.width || 0),
              height: Math.round(element.height || 0),
              rotation: element.rotation || 0
            }),
          });
          
          if (!response.ok) {
            throw new Error(`Failed to save element ${element.id}: ${response.status}`);
          }
          
          return response.json();
        });
        
        await Promise.all(savePromises);
        console.log('🎭 All hall elements saved successfully to server');
        
        // שמור את המפתח של השמירה הנוכחית
        window.lastHallElementsSaveKey = saveKey;
        
      } catch (error) {
        console.error('🎭 Error saving hall elements to server:', error);
        alert(`שגיאה בשמירת אלמנטי האולם: ${error.message}`);
      }
    };
    
    // שמור מיידית
    saveHallElements();
    
  }, [hallElements, eventId, activeHallTab, loading, draggedElementType, resizingElement, rotatingElement]);

  // שמירה אוטומטית של מיקומי השולחנות
  useEffect(() => {
    const saveTablePositions = async () => {
      if (loading || draggedElementType) {
        return; // אל תשמור במהלך גרירה
      }
      
      if (tablePositions.length === 0) {
        return; // אל תשמור אם אין מיקומים
      }
      
      try {
        console.log('🎭 Auto-saving table positions...');
        await saveTablePositionsToServer();
        console.log('🎭 Table positions auto-saved');
      } catch (error) {
        console.error('Error auto-saving table positions:', error);
      }
    };
    
    // הוסף השהייה קצרה לפני שמירה כדי למנוע שליחות מרובות
    const timeoutId = setTimeout(saveTablePositions, 2000);
    return () => clearTimeout(timeoutId);
    
  }, [tablePositions, eventId, activeHallTab, loading, draggedElementType]);

  // הוספת סוג שולחן
  const handleAddTableType = async () => {
    if (isViewer) {
      showNoPermission();
      return;
    }
    // בדיקות תקינות מחמירות יותר
    const size = Number(newTable.size);
    const count = Number(newTable.count);
    
    if (!newTable.size || !newTable.count || 
        isNaN(size) || isNaN(count) || 
        size < 1 || count < 1) {
      alert('אנא הזן גודל שולחן וכמות תקינים (מספרים גדולים מ-0)');
      return;
    }
    
    console.log('Adding new table type:', { ...newTable, hall_type: activeHallTab });
    
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        alert('אין הרשאה - אנא התחברי מחדש');
        return;
      }
      
      // קבל את כל השולחנות הקיימים מהשרת
      const response = await fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch existing tables');
      }
      
      const existingTables = await response.json();
      const nextTableNumber = existingTables.length > 0 ? Math.max(...existingTables.map(t => Number(t.table_number) || 0)) + 1 : 1;
      
      // צור את השולחנות החדשים בשרת
      const newTables = [];
      for (let i = 0; i < count; i++) {
        const tableNumber = nextTableNumber + i;
        const x = 40 + (existingTables.length + i) % 10 * 140;
        const y = 40 + Math.floor((existingTables.length + i) / 10) * 140;
        
        const newTableData = {
          event_id: Number(eventId),
          table_number: tableNumber,
          size: size,
          shape: newTable.shape,
          x: x,
          y: y,
          table_head: null,
          category: null,
          hall_type: activeHallTab,
        };
        
        const createResponse = await fetch(`http://localhost:8001/tables/event/${eventId}/add-single`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(newTableData),
        });
        
        if (createResponse.ok) {
          const createdTable = await createResponse.json();
          newTables.push(createdTable);
        } else {
          console.error('Failed to create table:', createResponse.status);
        }
      }
      
      console.log('Created new tables:', newTables);
      
      // עדכן את המצב המקומי
      setTableTypes(prev => {
        const updated = [...prev, { 
          size: size,
          count: count,
          shape: newTable.shape 
        }];
        console.log('Updated table types:', updated);
        return updated;
      });
      
      // רענן את השולחנות מהשרת
      const refreshResponse = await fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (refreshResponse.ok) {
        const refreshedTables = await refreshResponse.json();
        setTables(Array.isArray(refreshedTables) ? refreshedTables : []);
        
        // עדכן את המיקומים
        const serverPositions = refreshedTables.map(t => ({ x: t.x, y: t.y }));
        setTablePositions(serverPositions);
      }
      
      setNewTable({ size: "", count: "", shape: "circular" });
      
    } catch (error) {
      console.error('Error adding table type:', error);
      alert('שגיאה בהוספת סוג השולחן');
    }
  };

  // מחיקת סוג שולחן
  const handleRemove = async (idx) => {
    if (isViewer) {
      showNoPermission();
      return;
    }
    console.log('Removing table type at index:', idx, 'from hall:', activeHallTab);
    
    const tableTypeToRemove = tableTypes[idx];
    if (!tableTypeToRemove) {
      console.error('Table type not found at index:', idx);
      return;
    }
    
    // אישור מהמשתמש
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את כל השולחנות מסוג "שולחן ל-${tableTypeToRemove.size} סועדים" (${tableTypeToRemove.count} שולחנות)?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('access_token');
      
      // קבל את כל השולחנות מהשרת
      const response = await fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch tables');
      }
      
      const allTables = await response.json();
      
      // מצא את השולחנות שמתאימים לסוג הזה
      const tablesToDelete = allTables.filter(table => 
        Number(table.size) === Number(tableTypeToRemove.size) && 
        table.shape === tableTypeToRemove.shape
      );
      
      console.log('Tables to delete:', tablesToDelete);
      
      // מחק את כל השולחנות שמתאימים לסוג הזה
      const deletePromises = tablesToDelete.map(table => 
        fetch(`http://localhost:8001/tables/${table.id}`, {
          method: 'DELETE',
          headers: { "Authorization": `Bearer ${token}` }
        })
      );
      
      const results = await Promise.allSettled(deletePromises);
      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
      const failed = results.length - succeeded;
      
      if (failed > 0) {
        alert(`נמחקו ${succeeded} שולחנות, נכשלו ${failed}`);
      } else {
        alert(`נמחקו בהצלחה ${succeeded} שולחנות`);
      }
      
      // עדכן את המצב המקומי
      setTableTypes(prev => {
        const updated = prev.filter((_, i) => i !== idx);
        console.log('Updated table types after removal:', updated);
        return updated;
      });
      
      // רענן את הנתונים מהשרת
      const refreshResponse = await fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (refreshResponse.ok) {
        const refreshedTables = await refreshResponse.json();
        setTables(Array.isArray(refreshedTables) ? refreshedTables : []);
        
        // עדכן את המיקומים
        const serverPositions = refreshedTables.map(t => ({ x: t.x, y: t.y }));
        setTablePositions(serverPositions);
      }
      
    } catch (error) {
      console.error('Error deleting table type:', error);
      alert('שגיאה במחיקת סוג השולחן');
    }
  };

  // שמירת מיקומי השולחנות בשרת
  const saveTablePositionsToServer = async () => {
    try {
      console.log('saveTablePositionsToServer called');
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.log('No token found');
        return;
      }
      
      console.log('Current tablePositions:', tablePositions);
      console.log('Event ID:', eventId, 'Hall type:', activeHallTab);
      
      // קבל את כל השולחנות מהשרת
      const response = await fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!response.ok) {
        console.log('Failed to fetch tables from server:', response.status);
        return;
      }
      
      const allTables = await response.json();
      console.log('Fetched tables from server:', allTables);
      
      // עדכן את המיקומים של השולחנות
      const updatePromises = allTables.map((table, idx) => {
        const newPosition = tablePositions[idx];
        if (newPosition && (table.x !== newPosition.x || table.y !== newPosition.y)) {
          console.log(`Updating table ${table.id} position from (${table.x}, ${table.y}) to (${newPosition.x}, ${newPosition.y})`);
          return fetch(`http://localhost:8001/tables/${table.id}`, {
            method: 'PUT',
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({
              x: newPosition.x,
              y: newPosition.y
            })
          });
        }
        return Promise.resolve();
      });
      
      const results = await Promise.all(updatePromises);
      console.log('Update results:', results);
      console.log('Table positions saved to server');
      
    } catch (error) {
      console.error('Error saving table positions to server:', error);
    }
  };

  // גרירה של שולחנות
  const handleTableMouseDown = (e, idx) => {
    if (isViewer) {
      showNoPermission();
      return;
    }
    console.log('Starting drag for table:', idx, 'in hall:', activeHallTab);
    // שמירת נקודת התחלה במסך ושמירת המיקום הנוכחי במרחב המפה (world)
    const currentPos = tablePositions[idx] || { x: 40 + (idx % 8) * 140, y: 40 + Math.floor(idx / 8) * 140 };
    dragInfo.current = {
      idx,
      mouseStartX: e.clientX,
      mouseStartY: e.clientY,
      startX: currentPos.x || 0,
      startY: currentPos.y || 0,
    };
    setDraggedElementType('table');
    setDraggedElementId(idx);
    document.addEventListener("mousemove", handleTableMouseMove);
    document.addEventListener("mouseup", handleTableMouseUp);
  };

  const handleTableMouseMove = e => {
    const { idx, mouseStartX, mouseStartY, startX, startY } = dragInfo.current;
    if (idx === null) return;
    // המפה מוגדלת/מוקטנת; תרגם תזוזה במסך למרחב המפה באמצעות חלוקה ב-zoom
    const dx = (e.clientX - mouseStartX) / (zoom || 1);
    const dy = (e.clientY - mouseStartY) / (zoom || 1);
    let x = startX + dx;
    let y = startY + dy;

    // הגבלת גרירה כך שהשולחנות לא "יעופו" רחוק מהאיזור
    const maxWorldSize = 4000; // גבול הגיוני למפה
    const minX = -800;
    const minY = -800;
    const maxX = maxWorldSize;
    const maxY = maxWorldSize;
    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));
    setTablePositions(pos => {
      const newPos = [...pos];
      newPos[idx] = { 
        x: Math.round(x), // עיגול למספר שלם
        y: Math.round(y)  // עיגול למספר שלם
      };
      return newPos;
    });
  };

  const handleTableMouseUp = async () => {
    console.log('🎭 Finished dragging table in hall:', activeHallTab);
    dragInfo.current.idx = null;
    setDraggedElementType(null);
    setDraggedElementId(null);
    document.removeEventListener("mousemove", handleTableMouseMove);
    document.removeEventListener("mouseup", handleTableMouseUp);
    
    // שמור את המיקומים החדשים בשרת
    console.log('🎭 About to save table positions to server...');
    await saveTablePositionsToServer();
    console.log('🎭 Table positions save completed');
  };

  // גרירה של אלמנטי אולם
  const handleHallElementMouseDown = (e, elementId) => {
    if (isViewer) {
      showNoPermission();
      return;
    }
    console.log('🎭 Starting drag for hall element:', elementId);
    console.log('🎭 Mouse event:', e);
    console.log('🎭 CurrentTarget element:', e.currentTarget);
    
    const element = hallElements.find(el => el.id === elementId);
    if (!element) return;
    
    // שמירה של נקודת ההתחלה במונחי המסך + המיקום ההתחלתי של האלמנט
    dragInfo.current = {
      mouseStartX: e.clientX,
      mouseStartY: e.clientY,
      startX: element.x || 0,
      startY: element.y || 0,
      lastDraggedId: elementId,
    };
    
    // שמור את ה-ID ב-ref
    draggedElementIdRef.current = elementId;
    
    console.log('🎭 Drag info set (delta-based):', dragInfo.current);
    console.log('🎭 Dragged element ID ref set:', draggedElementIdRef.current);
    
    setDraggedElementType('hall_element');
    setDraggedElementId(elementId);
    document.addEventListener("mousemove", handleHallElementMouseMove);
    document.addEventListener("mouseup", handleHallElementMouseUp);
    
    console.log('🎭 Event listeners added, drag started!');
  };

  const handleHallElementMouseMove = e => {
    const currentDraggedId = draggedElementIdRef.current; // השתמש ב-ref
    const { mouseStartX, mouseStartY, startX, startY } = dragInfo.current || {};
    
    if (!currentDraggedId || mouseStartX == null) {
      console.log('🎭 No dragged element ID in ref, skipping move');
      return;
    }
    
    // התאמה ל-zoom: תזוזת העכבר על המסך לתזוזה במרחב המפה
    const dx = (e.clientX - mouseStartX) / (zoom || 1);
    const dy = (e.clientY - mouseStartY) / (zoom || 1);
    const x = startX + dx;
    const y = startY + dy;
    
    setHallElements(prev => {
      const updated = prev.map(el => 
        el.id === currentDraggedId 
        ? { ...el, x, y }
        : el
      );
      return updated;
    });
  };

  const handleHallElementMouseUp = () => {
    console.log('🎭 Finished dragging hall element');
    console.log('🎭 Current draggedElementId from ref:', draggedElementIdRef.current);
    
    // שמור את המיקום החדש לשרת לפני איפוס
    const currentDraggedId = draggedElementIdRef.current;
    if (currentDraggedId) {
      const element = hallElements.find(el => el.id === currentDraggedId);
      if (element) {
        const nudged = nudgeHallElementOffTables(element);
        if (nudged.x !== element.x || nudged.y !== element.y) {
          setHallElements(prev => prev.map(el => el.id === element.id ? { ...el, x: nudged.x, y: nudged.y } : el));
        }
        console.log('🎭 Saving position for element:', element.id, 'at:', nudged.x, nudged.y);
        handleUpdateHallElementPosition(element.id, nudged.x, nudged.y);
      }
    }
    
    // נקה את האירועים
    document.removeEventListener("mousemove", handleHallElementMouseMove);
    document.removeEventListener("mouseup", handleHallElementMouseUp);
    
    // איפוס המצב
    setDraggedElementType(null);
    setDraggedElementId(null);
    draggedElementIdRef.current = null; // נקה את ה-ref
    
    // נקה את המידע
    dragInfo.current = {};
    console.log('🎭 Drag cleanup completed');
  };

  // פונקציה לעדכון מיקום אלמנט אולם בשרת
  const handleUpdateHallElementPosition = async (elementId, x, y) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8001/tables/hall-elements/${elementId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ x, y }),
      });

      if (!response.ok) {
        console.error('Failed to update hall element position');
      } else {
        console.log('🎭 Hall element position updated successfully');
      }
    } catch (error) {
      console.error('Error updating hall element position:', error);
    }
  };

  // פונקציות לעדכון בשרת - עכשיו לא נצטרך אותן כי יש שמירה אוטומטית
  const handleUpdateHallElementSize = async (elementId, width, height) => {
    // לא נצטרך את זה יותר כי יש שמירה אוטומטית
    console.log('🎭 Size update handled by automatic save');
  };

  const handleUpdateHallElementRotation = async (elementId, rotation) => {
    // לא נצטרך את זה יותר כי יש שמירה אוטומטית
    console.log('🎭 Rotation update handled by automatic save');
  };

  // מחיקת אלמנט אולם
  const readErrorDetail = async (response) => {
    try {
      const text = await response.text();
      return text || response.statusText;
    } catch (e) {
      return response.statusText;
    }
  };

  const handleRemoveHallElement = async (elementId) => {
    if (isViewer) {
      showNoPermission();
      return;
    }
    if (elementId === undefined || elementId === null || Number.isNaN(Number(elementId))) {
      alert("לא נמצא מזהה אלמנט תקין למחיקה");
      return;
    }
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8001/tables/hall-elements/${elementId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) {
        const detail = await readErrorDetail(response);
        throw new Error(`HTTP ${response.status} - ${detail}`);
      }
      setHallElements(prev => prev.filter(el => el.id !== elementId));
    } catch (error) {
      console.error('Error removing hall element:', error);
      alert(`שגיאה במחיקת אלמנט: ${error.message}`);
    }
  };

  // הוספת אלמנט אולם חדש
  const handleAddHallElement = async () => {
    if (isViewer) {
      showNoPermission();
      return;
    }
    if (!newHallElement.element_type) return;
    
    // בדיקה אם האלמנט נעול ל-PRO
    if (!FREE_ELEMENT_TYPES.includes(newHallElement.element_type)) {
      setShowProMessage(true);
      setTimeout(() => setShowProMessage(false), 3000);
      return;
    }
    
    try {
      const token = localStorage.getItem('access_token');
      const defaults = resolveHallElementDefaults(newHallElement.element_type);
      const autoName = generateHallElementName(newHallElement.element_type);
      
      const elementData = {
        event_id: Number(eventId),
        name: autoName,
        element_type: newHallElement.element_type,
        width: newHallElement.width ? Number(newHallElement.width) : defaults.width,
        height: newHallElement.height ? Number(newHallElement.height) : defaults.height,
        x: defaults.x,
        y: defaults.y,
        hall_type: activeHallTab,
        properties: null
      };

      console.log('🎭 Adding hall element with data:', elementData);
      console.log('🎭 Initial dimensions for element:', defaults.width, 'x', defaults.height);
      console.log('🎭 Element type:', newHallElement.element_type, 'Initial size:', defaults.width, 'x', defaults.height);
      const response = await fetch(`http://localhost:8001/tables/hall-elements/event/${eventId}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(elementData),
      });

      if (!response.ok) {
        const detail = await readErrorDetail(response);
        throw new Error(`HTTP ${response.status} - ${detail}`);
      }

      const newElement = await response.json();
      console.log('🎭 New hall element created successfully:', newElement);
      console.log('🎭 Saved dimensions in server:', newElement.width, 'x', newElement.height);
      setHallElements(prev => [...prev, newElement]);
      setNewHallElement({ name: "", element_type: "stage", width: "", height: "" });
    } catch (error) {
      console.error('Error adding hall element:', error);
      alert(`שגיאה בהוספת אלמנט: ${error.message}`);
    }
  };

  // פונקציה לעדכון גודל הבמה
  const handleUpdateStageSize = async (elementId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8001/tables/hall-elements/${elementId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          width: 1200, 
          height: 200 
        }),
      });

      if (response.ok) {
        console.log('🎭 Stage size updated successfully to 1200x200');
        // רענן את הרשימה
        const updatedElements = hallElements.map(el => 
          el.id === elementId 
            ? { ...el, width: 1200, height: 200 }
            : el
        );
        setHallElements(updatedElements);
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error updating stage size:', error);
      alert(`שגיאה בעדכון גודל הבמה: ${error.message}`);
    }
  };

  // פונקציות לשינוי גודל וסיבוב
  const handleResizeStart = (e, elementId) => {
    if (isViewer) return;
    e.stopPropagation();
    const element = hallElements.find(el => el.id === elementId);
    if (element) {
      setResizingElement(elementId);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: element.width || 120,
        height: element.height || 80,
        zoomAtStart: zoom
      });
      document.addEventListener("mousemove", handleResizeMove);
      document.addEventListener("mouseup", handleResizeEnd);
    }
  };

  const handleResizeMove = (e) => {
    if (!resizingElement) return;
    // התאמה לזום: ההזזה במסך מחולקת ב-zoom כדי לקבל שינוי בגודל במרחב המפה
    const deltaX = (e.clientX - resizeStart.x) / (resizeStart.zoomAtStart || 1);
    const deltaY = (e.clientY - resizeStart.y) / (resizeStart.zoomAtStart || 1);
    
    const element = hallElements.find(el => el.id === resizingElement);
    const isEntrance = element?.element_type === 'entrance';
    
    // כניסה יכולה להיות צרה יותר (מינימום 5 פיקסלים)
    const minWidth = isEntrance ? 5 : 50;
    const minHeight = isEntrance ? 15 : 50;
    
    let newWidth = Math.max(minWidth, resizeStart.width + deltaX);
    let newHeight = Math.max(minHeight, resizeStart.height + deltaY);
    
    // Snap עדין ומדויק כמו בוורד: החזק Shift כדי לקפוץ בקפיצות של 5px
    if (e.shiftKey) {
      const snap = 5;
      newWidth = Math.round(newWidth / snap) * snap;
      newHeight = Math.round(newHeight / snap) * snap;
    }
    
    setHallElements(prev => prev.map(el => 
      el.id === resizingElement 
        ? { ...el, width: newWidth, height: newHeight }
        : el
    ));
  };

  const handleResizeEnd = () => {
    if (resizingElement) {
      setResizingElement(null);
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
    }
  };

  const handleRotateStart = (e, elementId) => {
    if (isViewer) return;
    e.stopPropagation();
    const element = hallElements.find(el => el.id === elementId);
    if (element) {
      const rect = e.target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
      
      setRotatingElement(elementId);
      setRotateStart({
        x: e.clientX,
        y: e.clientY,
        angle: angle
      });
      document.addEventListener("mousemove", handleRotateMove);
      document.addEventListener("mouseup", handleRotateEnd);
    }
  };

  const handleRotateMove = (e) => {
    if (!rotatingElement) return;
    const element = hallElements.find(el => el.id === rotatingElement);
    if (element) {
      const rect = e.target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const newAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180 / Math.PI;
      
      setHallElements(prev => prev.map(el => 
        el.id === rotatingElement 
          ? { ...el, rotation: newAngle }
          : el
      ));
    }
  };

  const handleRotateEnd = () => {
    if (rotatingElement) {
      setRotatingElement(null);
      document.removeEventListener("mousemove", handleRotateMove);
      document.removeEventListener("mouseup", handleRotateEnd);
    }
  };

  // כשמחליפים אולם, נאפס את המצב וטען מחדש את השולחנות
  useEffect(() => {
    console.log('Hall type changed to:', activeHallTab);
    
    // שמור את המצב הנוכחי לפני החלפה
    if (tablePositions.length > 0) {
      const localStorageKey = `tablePositions_${eventId}_${activeHallTab === 'm' ? 'w' : 'm'}`;
      localStorage.setItem(localStorageKey, JSON.stringify(tablePositions));
    }
    
    if (hallElements.length > 0) {
      const localStorageKey = `hallElementPositions_${eventId}_${activeHallTab === 'm' ? 'w' : 'm'}`;
      const positionsToSave = hallElements.map(el => ({
        id: el.id,
        x: Math.round(el.x || 0),
        y: Math.round(el.y || 0),
        width: Math.round(el.width || 0),
        height: Math.round(el.height || 0),
        rotation: el.rotation || 0
      }));
      localStorage.setItem(localStorageKey, JSON.stringify(positionsToSave));
    }
    
    // אפס את המצב הנוכחי
    setTableTypes([]);
    setTablePositions([]);
    setNewTable({ size: "", count: "", shape: "circular" });
    setShowMap(false);
    
    // טען מחדש את השולחנות לאולם החדש
    const loadTablesForNewHall = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`http://localhost:8001/tables/event/${eventId}?hall_type=${activeHallTab}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          console.log('Fetched tables for new hall:', data);
          console.log('Number of tables for new hall:', data.length);
          console.log('New hall type:', activeHallTab);
          setTables(Array.isArray(data) ? data : []);
          setTableCategories((Array.isArray(data) ? data : []).map(t => t.category || ''));
          
          // קיבוץ לפי size ו-shape
          const typeMap = {};
          data.forEach(t => {
            console.log('Processing table for typeMap:', {
              id: t.id,
              size: t.size,
              sizeType: typeof t.size,
              shape: t.shape,
              shapeType: typeof t.shape
            });
            
            // Handle null/undefined size by using a default value instead of skipping
            let tableSize = t.size;
            if (tableSize === null || tableSize === undefined || isNaN(Number(tableSize))) {
              console.warn('Table has invalid size, using default size 4:', t);
              tableSize = 4; // Use default size instead of skipping
            }
            const key = `${tableSize}_${t.shape || 'circular'}`;
            if (!typeMap[key]) typeMap[key] = { size: Number(tableSize), count: 0, shape: t.shape || 'circular' };
            typeMap[key].count++;
            console.log('Added to typeMap:', key, typeMap[key]);
          });
          const types = Object.values(typeMap);
          console.log('Grouped table types for new hall:', types);
          setTableTypes(types);
          
          // טען מיקומים מהשרת או מ-localStorage
          const serverPositions = data.map(t => ({ x: t.x, y: t.y }));
          const localStorageKey = `tablePositions_${eventId}_${activeHallTab}`;
          const savedPositions = localStorage.getItem(localStorageKey);
          
          let positionsToUse = serverPositions;
          
          // בדיקה אם המיקומים מהשרת ריקים או לא מסודרים - אם כן, נשתמש בחישוב אוטומטי
          const hasValidPositions = serverPositions.every(pos => pos.x && pos.y && pos.x > 0 && pos.y > 0);
          
          if (!hasValidPositions) {
            console.log('Server positions are invalid, using auto layout');
            positionsToUse = computeAutoLayout(data.length);
          } else if (savedPositions && serverPositions.length > 0) {
            try {
              const parsedPositions = JSON.parse(savedPositions);
              if (parsedPositions.length === serverPositions.length) {
                console.log('Using saved positions from localStorage for new hall');
                positionsToUse = parsedPositions;
              }
            } catch (error) {
              console.error('Error parsing saved positions for new hall:', error);
            }
          }
          
          setTablePositions(positionsToUse);
        }
      } catch (error) {
        console.error('Error loading tables for new hall:', error);
      }
    };
    
    loadTablesForNewHall();
  }, [activeHallTab, eventId]);
  
  // בדיקה נוספת
  console.log('=== DEBUG INFO ===');
  console.log('tableTypes:', tableTypes);
  console.log('allTables:', allTables);
  console.log('tablePositions:', tablePositions);
  
  // פונקציה לשיבוץ אוטומטי של שולחנות ברשת ללא חפיפה
  const computeAutoLayout = (count, options = {}) => {
    const {
      margin = 40,
      cell = 140,
      columns = 10,
    } = options;
    const positions = [];
    for (let i = 0; i < count; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = margin + col * cell;
      const y = margin + row * cell;
      positions.push({ x, y });
    }
    return positions;
  };

  // זיהוי חפיפה לפי סף מרחק (כדי לזהות גם כמעט-אותו-מיקום)
  const hasOverlapWithin = (positions, threshold = 100) => {
    if (!Array.isArray(positions)) return false;
    for (let i = 0; i < positions.length; i++) {
      const a = positions[i];
      if (!a || typeof a.x !== 'number' || typeof a.y !== 'number') return true;
      for (let j = i + 1; j < positions.length; j++) {
        const b = positions[j];
        if (!b || typeof b.x !== 'number' || typeof b.y !== 'number') return true;
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        if (dx < threshold && dy < threshold) return true;
      }
    }
    return false;
  };

  // חישוב שיבוץ אוטומטי עבור אלמנטי אולם (במה/כניסה)
  const computeHallElementsAutoLayout = (elements, options = {}) => {
    const margin = 40;
    const gap = 40;
    const defaultStage = { width: 1200, height: 200 };
    const defaultEntrance = { width: 40, height: 100 };

    const mapWidth = (mapRef.current?.clientWidth || 1400);
    const mapHeight = (mapRef.current?.clientHeight || 800);

    const placed = [];
    const isFree = (rect) => {
      // מול אלמנטים שכבר הונחו
      const collidePlaced = placed.some(p => !(rect.right <= p.left || rect.left >= p.right || rect.bottom <= p.top || rect.top >= p.bottom));
      if (collidePlaced) return false;
      // מול שולחנות
      const collideTables = tablePositions.some(pos => {
        const t = { left: pos.x, top: pos.y, right: pos.x + 120, bottom: pos.y + 120 };
        return !(rect.right <= t.left || rect.left >= t.right || rect.bottom <= t.top || rect.top >= t.bottom);
      });
      return !collideTables;
    };

    const tryPlace = (w, h, startX, startY) => {
      const step = 40; // צעדי חיפוש
      for (let y = startY; y + h + margin < mapHeight; y += step) {
        for (let x = startX; x + w + margin < mapWidth; x += step) {
          const rect = { left: x, top: y, right: x + w, bottom: y + h };
          if (isFree(rect)) return rect;
        }
      }
      // fallback: החזר למרווח ההתחלתי
      return { left: margin, top: margin, right: margin + w, bottom: margin + h };
    };

    const result = elements.map(raw => {
      const el = { ...raw };
      const w = Number(el.width) || (el.element_type === 'stage' ? defaultStage.width : defaultEntrance.width);
      const h = Number(el.height) || (el.element_type === 'stage' ? defaultStage.height : defaultEntrance.height);
      const startX = el.element_type === 'stage' ? margin : Math.min(margin, mapWidth - w - margin);
      const startY = el.element_type === 'stage' ? margin : Math.max(margin * 2 + defaultStage.height, margin);
      const placedRect = tryPlace(w, h, startX, startY);
      el.x = placedRect.left;
      el.y = placedRect.top;
      placed.push(placedRect);
      return el;
    });

    return result;
  };

  // בדיקת חפיפה מדויקת לאלמנטי אולם לפי מלבנים
  const hasHallElementsOverlap = (elements) => {
    const getRect = (el) => ({
      left: Number(el.x) || 0,
      top: Number(el.y) || 0,
      right: (Number(el.x) || 0) + (Number(el.width) || (el.element_type === 'stage' ? 1200 : 40)),
      bottom: (Number(el.y) || 0) + (Number(el.height) || (el.element_type === 'stage' ? 200 : 100))
    });
    for (let i = 0; i < elements.length; i++) {
      const a = elements[i];
      if (typeof a.x !== 'number' || typeof a.y !== 'number') return true;
      const ra = getRect(a);
      for (let j = i + 1; j < elements.length; j++) {
        const b = elements[j];
        if (typeof b.x !== 'number' || typeof b.y !== 'number') return true;
        const rb = getRect(b);
        const overlap = !(ra.right <= rb.left || ra.left >= rb.right || ra.bottom <= rb.top || ra.top >= rb.bottom);
        if (overlap) return true;
      }
    }
    return false;
  };

  // מניעת חפיפה: אם אלמנט אולם נופל על שולחן – הזז לשמאל לפני שמירה
  const nudgeHallElementOffTables = (element) => {
    const el = { ...element };
    const elWidth = Number(el.width) || (el.element_type === 'stage' ? 1200 : 40);
    const elHeight = Number(el.height) || (el.element_type === 'stage' ? 200 : 100);
    const elRect = { left: el.x, top: el.y, right: el.x + elWidth, bottom: el.y + elHeight };
    const tablesOverlap = tablePositions.some((pos) => {
      if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return false;
      const tRect = { left: pos.x, top: pos.y, right: pos.x + 120, bottom: pos.y + 120 };
      const isOverlap = !(elRect.right <= tRect.left || elRect.left >= tRect.right || elRect.bottom <= tRect.top || elRect.top >= tRect.bottom);
      return isOverlap;
    });
    if (tablesOverlap) {
      el.x = 40; // דחיפה לעמודה השמאלית הבטוחה
    }
    return el;
  };

  // טען קטגוריות קיימות מראשי שולחן לפי אולם (מגדר)
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

  return (
    <div style={{ background: '#f8fafc', borderRadius: 16, boxShadow: '0 2px 12px #0001', padding: 32, margin: '30px auto', maxWidth: '95%', width: '100%', position: 'relative' }}>
      {permissionMessage && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(15,23,42,0.96)',
            color: '#fff',
            padding: '16px 24px',
            borderRadius: 16,
            fontSize: 14,
            zIndex: 2000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            textAlign: 'center',
            minWidth: 260
          }}
        >
          {permissionMessage}
        </div>
      )}
      
      {/* הודעת שדרוג ל-PRO */}
      {showProMessage && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
          color: '#fff',
          padding: '20px 30px',
          borderRadius: 16,
          fontSize: 18,
          fontWeight: 700,
          zIndex: 2000,
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span style={{ fontSize: 28 }}>👑</span> שדרג ל-PRO כדי ליהנות מתוכן זה
        </div>
      )}
      {/* טאבים לבחירת אולם */}
      <div className="tropical-filters" style={{ marginBottom: 24 }}>
        <button
          onClick={() => setActiveHallTab('m')}
          className={`tropical-pill-filter ${activeHallTab === 'm' ? 'tropical-pill-filter--active' : ''}`}
          style={{ flex: 1 }}
        >
          אולם גברים
        </button>
        <button
          onClick={() => setActiveHallTab('w')}
          className={`tropical-pill-filter ${activeHallTab === 'w' ? 'tropical-pill-filter--active' : ''}`}
          style={{ flex: 1 }}
        >
          אולם נשים
        </button>
      </div>

      <h2 style={{ fontWeight: 700, fontSize: 24, marginBottom: 24 }}>
        הגדרות {activeHallTab === 'm' ? 'אולם גברים' : 'אולם נשים'}
      </h2>

      {/* פריסה לרוחב - שתי עמודות */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: 32, 
        marginBottom: 32
      }}>
        {/* עמודה שמאלית - אלמנטי אולם */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* טופס הוספת אלמנט אולם */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 16px 0', fontWeight: 600, fontSize: 18 }}>הוספת אלמנטי אולם:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <select
                value={newHallElement.element_type}
                onChange={e => setNewHallElement({ ...newHallElement, element_type: e.target.value })}
                className="tropical-input"
                style={{ width: '100%', fontSize: 16 }}
              >
                {HALL_ELEMENT_ORDER.map((typeKey) => {
                  const cfg = getHallElementConfig(typeKey);
                  const isLocked = !FREE_ELEMENT_TYPES.includes(typeKey);
                  return (
                    <option key={typeKey} value={typeKey}>
                      {isLocked ? `🔒 ${cfg.label}` : cfg.label}
                    </option>
                  );
                })}
              </select>
              <button
                onClick={handleAddHallElement}
                disabled={isViewer}
                className="tropical-button-primary"
                style={{
                  cursor: isViewer ? 'not-allowed' : 'pointer',
                  opacity: isViewer ? 0.75 : 1,
                  width: '100%'
                }}
              >
                + הוסף אלמנט
              </button>
            </div>

            {/* רשימת אלמנטי אולם */}
            {hallElements.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontWeight: 600, fontSize: 16 }}>אלמנטי אולם קיימים:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '250px', overflowY: 'auto' }}>
                  {hallElements
                    .filter(element => element.id !== undefined && element.id !== null && !Number.isNaN(Number(element.id)))
                    .map((element) => (
                    <div key={element.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: '#fff',
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0'
                    }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: 4, 
                        fontSize: 12, 
                        fontWeight: 600,
                        background: resolveHallElementDefaults(element.element_type).color,
                        color: 'white'
                      }}>
                        {resolveHallElementDefaults(element.element_type).label}
                      </span>
                      <span style={{ flex: 1, fontSize: 16 }}>{element.name}</span>
                      {element.width && element.height && (
                        <span style={{ color: '#64748b', fontSize: 14 }}>
                          {(() => {
                            const width = parseFloat(element.width);
                            const height = parseFloat(element.height);
                            const formattedWidth = Number.isInteger(width) ? width.toString() : width.toFixed(2);
                            const formattedHeight = Number.isInteger(height) ? height.toString() : height.toFixed(2);
                            return `${formattedWidth}×${formattedHeight} px`;
                          })()}
                        </span>
                      )}
                      {element.id !== undefined && element.id !== null && !Number.isNaN(Number(element.id)) ? (
                        <button
                          onClick={() => handleRemoveHallElement(element.id)}
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 16px',
                            fontWeight: 600,
                            cursor: isViewer ? 'not-allowed' : 'pointer',
                            opacity: isViewer ? 0.75 : 1
                          }}
                        >
                          מחק
                        </button>
                      ) : (
                        <span style={{ color: '#ef4444', fontSize: 12, fontStyle: 'italic' }}>
                          אין מזהה תקין
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* עמודה ימנית - סוגי שולחנות */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* טופס הוספת סוג שולחן */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 16px 0', fontWeight: 600, fontSize: 18 }}>הוספת סוג שולחן:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              <input
                type="number"
                min={1}
                placeholder="גודל שולחן (כמות כסאות)"
                value={newTable.size}
                onChange={e => setNewTable({ ...newTable, size: e.target.value })}
                style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', width: '100%', fontSize: 16 }}
              />
              <select
                value={newTable.shape}
                onChange={e => setNewTable({ ...newTable, shape: e.target.value })}
                className="tropical-input"
                style={{ width: '100%', fontSize: 16 }}
              >
                <option value="circular">עגול</option>
                <option value="rectangular">מרובע</option>
                <option value="oblong">מלבן (ארוך)</option>
              </select>
              <input
                type="number"
                min={1}
                placeholder="כמות שולחנות"
                value={newTable.count}
                onChange={e => setNewTable({ ...newTable, count: e.target.value })}
                className="tropical-input"
                style={{ width: '100%', fontSize: 16 }}
              />
              <button
                onClick={handleAddTableType}
                disabled={isViewer}
                className="tropical-button-primary"
                style={{
                  cursor: isViewer ? 'not-allowed' : 'pointer',
                  opacity: isViewer ? 0.75 : 1,
                  width: '100%'
                }}
              >
                + הוסף סוג שולחן
              </button>
            </div>

            {/* רשימת סוגי שולחנות */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontWeight: 600, fontSize: 16 }}>סוגי שולחנות:</h4>
              {tableTypes.length === 0 && (
                <div style={{ color: '#64748b', background: '#f1f5f9', padding: 16, borderRadius: 8, textAlign: 'center' }}>
                  לא הוגדרו סוגי שולחנות
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '250px', overflowY: 'auto' }}>
                {tableTypes.map((t, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: '#fff',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0'
                  }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: 4, 
                      fontSize: 12, 
                      fontWeight: 600,
                      background: t.shape === 'circular' ? '#4f8cff' : (t.shape === 'rectangular' ? '#8b5cf6' : '#10b981'),
                      color: 'white'
                    }}>
                      {t.shape === 'circular' ? 'עגול' : (t.shape === 'rectangular' ? 'מרובע' : 'מלבן (ארוך)')}
                    </span>
                    <span style={{ flex: 1, fontSize: 16 }}>שולחן ל-{t.size} סועדים × {t.count} שולחנות</span>
                    <button
                      onClick={() => handleRemove(idx)}
                      disabled={isViewer}
                      className="tropical-button-primary"
                      style={{
                        background: 'var(--color-error, #ef4444)',
                        cursor: isViewer ? 'not-allowed' : 'pointer',
                        opacity: isViewer ? 0.75 : 1,
                        padding: '8px 16px',
                      }}
                    >
                      מחק
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* כפתור להצגת מפת האולם */}
      <button
        onClick={() => setShowMap(true)}
        className="tropical-button-primary"
        style={{
          marginBottom: 24
        }}
      >
        הצג מפת האולם
      </button>

      {/* מפת האולם */}
      {showMap && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '95vw', height: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <button onClick={handleZoomOut} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer' }}>-</button>
                <span style={{ minWidth: 60, textAlign: 'center', fontWeight: 600 }}>{Math.round(zoom * 100)}%</span>
                <button onClick={handleZoomIn} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer' }}>+</button>
                <button
                  onClick={fitMapToTables}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid #e5e7eb',
                    background: '#e0f2fe',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#0369a1'
                  }}
                >
                  התאם לכל השולחנות
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 24 }}>מפת האולם - מבט מלמעלה</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('access_token');
                      
                      // שמור שולחנות
                      for (const table of tablePositions) {
                        await fetch(`http://localhost:8001/tables/${table.id}`, {
                          method: "PUT",
                          headers: { 
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            x: Math.round(table.x || 0),
                            y: Math.round(table.y || 0)
                          }),
                        });
                      }
                      
                      // שמור אלמנטים
                      for (const element of hallElements) {
                        await fetch(`http://localhost:8001/tables/hall-elements/${element.id}`, {
                          method: "PUT",
                          headers: { 
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                          },
                          body: JSON.stringify({
                            x: Math.round(element.x || 0),
                            y: Math.round(element.y || 0),
                            width: Math.round(element.width || 0),
                            height: Math.round(element.height || 0),
                            rotation: element.rotation || 0
                          }),
                        });
                      }
                      
                      console.log('✅ All positions saved successfully');
                      alert('המיקומים נשמרו בהצלחה!');
                      setShowMap(false);
                    } catch (error) {
                      console.error('Error saving positions:', error);
                      alert('שגיאה בשמירה: ' + error.message);
                    }
                  }}
                  className="tropical-button-primary"
                  style={{
                    background: 'var(--color-success, #22c55e)',
                  }}
                >
                  שמור וסגור
                </button>
                <button
                  onClick={() => setShowMap(false)}
                  className="tropical-button-primary"
                  style={{
                    background: 'var(--color-error, #ef4444)',
                  }}
                >
                  סגור
                </button>
              </div>
            </div>
            
            {/* Hall Map */}
            <div className="hall-map-container">
              <div 
                className="hall-map"
                ref={mapRef}
                style={{
                  width: '100%',
                  height: '80vh',
                  border: '2px solid #ccc',
                  position: 'relative',
                  backgroundColor: '#f9f9f9',
                  overflow: 'hidden'
                }}
                onWheel={handleWheelZoom}
                onMouseDown={handleMapMouseDown}
              >
                {/* תוכן המפה (מוחל עליו ה-transform) */}
                <div
                  className="hall-map-content"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0'
                }}
              >
                {/* רקע המפה - רשת עזר */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundImage: `
                    linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
                  `,
                  backgroundSize: '50px 50px',
                  pointerEvents: 'none'
                }} />
                
                {/* הצג אלמנטי אולם */}
                  {hallElements.map((element) => {
                    const cfg = resolveHallElementDefaults(element.element_type);
                    const isStageFamily = cfg.family === 'stage';

                    return (
                  <div
                    key={element.id}
                    onMouseDown={e => handleHallElementMouseDown(e, element.id)}
                      onMouseEnter={() => setHoveredHallElementId(element.id)}
                      onMouseLeave={(e) => {
                        const rt = e.relatedTarget;
                        const isHandle = rt && rt.dataset && (rt.dataset.rotateHandleFor === String(element.id) || rt.dataset.resizeHandleFor === String(element.id));
                        if (isHandle) return; // אל תסתיר אם עוברים לידית
                        hoverTimeoutRef.current = setTimeout(() => {
                          setHoveredHallElementId(prev => (prev === element.id ? null : prev));
                        }, 150);
                      }}
                    style={{
                      position: 'absolute',
                      left: element.x || 100,
                      top: element.y || 100,
                        width: element.width || cfg.width,
                        height: element.height || cfg.height,
                      background: cfg.color,
                        borderRadius: isStageFamily ? '12px' : '6px',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                        fontSize: isStageFamily ? '24px' : '16px',
                        fontWeight: 700,
                        boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                      textAlign: 'center',
                        padding: '20px',
                      cursor: isViewer ? 'default' : 'move',
                      userSelect: 'none',
                        border: draggedElementType === 'hall_element' && draggedElementId === element.id ? '4px solid #ef4444' : (isStageFamily ? '5px solid #000' : '3px solid rgba(0,0,0,0.2)'),
                        zIndex: 10,
                        transform: element.rotation ? `rotate(${element.rotation}deg)` : 'none',
                        // הוספת אפקטים מיוחדים למשפחת הבמות
                        ...(isStageFamily && {
                          background: `linear-gradient(135deg, ${cfg.color} 0%, #d97706 100%)`,
                          border: '3px solid #d97706',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.25)',
                          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                        })
                      }}
                  >
                    <div>
                        <div style={{ 
                          fontSize: isStageFamily ? '24px' : '14px', 
                          marginBottom: isStageFamily ? '12px' : '4px',
                          fontWeight: 'bold',
                          textTransform: isStageFamily ? 'uppercase' : 'none',
                          letterSpacing: isStageFamily ? '2px' : 'normal'
                        }}>
                          {element.name || cfg.label}
                      </div>
                      </div>
                      
                      {/* Resize handles */}
                      {!isViewer && (hoveredHallElementId === element.id || resizingElement === element.id || (draggedElementType === 'hall_element' && draggedElementId === element.id)) && (
                        <>
                          {/* Bottom-right resize handle */}
                          <div
                            onMouseDown={e => handleResizeStart(e, element.id)}
                            onMouseEnter={() => setHoveredHallElementId(element.id)}
                            onMouseLeave={(e) => {
                              const rt = e.relatedTarget;
                              const isParent = rt && (rt === e.currentTarget.parentElement);
                              if (isParent) return; // מעבר חזרה לאלמנט הראשי - אל תסתיר
                              hoverTimeoutRef.current = setTimeout(() => {
                                setHoveredHallElementId(prev => (prev === element.id ? null : prev));
                              }, 150);
                            }}
                    style={{
                      position: 'absolute',
                              bottom: '-8px',
                              right: '-8px',
                              width: '16px',
                              height: '16px',
                              background: '#3b82f6',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'nw-resize',
                              zIndex: 20
                            }}
                            data-resize-handle-for={element.id}
                          />
                          {/* Bottom-left resize handle */}
                          <div
                            onMouseDown={e => handleResizeStart(e, element.id)}
                            onMouseEnter={() => setHoveredHallElementId(element.id)}
                            onMouseLeave={() => setHoveredHallElementId(prev => (prev === element.id ? null : prev))}
                            style={{
                              position: 'absolute',
                              bottom: '-8px',
                              left: '-8px',
                              width: '16px',
                              height: '16px',
                              background: '#3b82f6',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'ne-resize',
                              zIndex: 20
                            }}
                            data-resize-handle-for={element.id}
                          />
                          {/* Top-right resize handle */}
                          <div
                            onMouseDown={e => handleResizeStart(e, element.id)}
                            onMouseEnter={() => setHoveredHallElementId(element.id)}
                            onMouseLeave={() => setHoveredHallElementId(prev => (prev === element.id ? null : prev))}
                            style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              width: '16px',
                              height: '16px',
                              background: '#3b82f6',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'se-resize',
                              zIndex: 20
                            }}
                            data-resize-handle-for={element.id}
                          />
                          {/* Top-left resize handle */}
                          <div
                            onMouseDown={e => handleResizeStart(e, element.id)}
                            onMouseEnter={() => setHoveredHallElementId(element.id)}
                            onMouseLeave={() => setHoveredHallElementId(prev => (prev === element.id ? null : prev))}
                            style={{
                              position: 'absolute',
                              top: '-8px',
                              left: '-8px',
                              width: '16px',
                              height: '16px',
                              background: '#3b82f6',
                              border: '2px solid white',
                              borderRadius: '50%',
                              cursor: 'sw-resize',
                              zIndex: 20
                            }}
                            data-resize-handle-for={element.id}
                          />
                        </>
                      )}
                      
                      {/* Rotate handle */}
                      {!isViewer && (hoveredHallElementId === element.id || rotatingElement === element.id) && (
                        <div
                          onMouseDown={e => handleRotateStart(e, element.id)}
                          onMouseEnter={() => {
                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                            setHoveredHallElementId(element.id);
                          }}
                          onMouseLeave={(e) => {
                            const rt = e.relatedTarget;
                            const isParent = rt && (rt === e.currentTarget.parentElement);
                            if (isParent) return;
                            hoverTimeoutRef.current = setTimeout(() => {
                              setHoveredHallElementId(prev => (prev === element.id ? null : prev));
                            }, 150);
                          }}
                          style={{
                            position: 'absolute',
                            top: '-12px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '28px',
                            height: '28px',
                            background: '#10b981',
                            border: '2px solid white',
                            borderRadius: '50%',
                            cursor: 'grab',
                            zIndex: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                            fontSize: '16px',
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                          data-rotate-handle-for={element.id}
                        >
                          ↻
                    </div>
                      )}
                    </div>
                  );
                  })}
                  
                  {/* הצג שולחנות */}
                  {tablesForRender.map((table, idx) => {
                  console.log('Rendering table:', table, 'at index:', idx);
                  // שימוש באותו חישוב מיקום לכל האולמות - מסודר ברשת של 10 עמודות
                  const left = tablePositions[idx]?.x ?? 40 + (idx % 10) * 140;
                  const top = tablePositions[idx]?.y ?? 40 + Math.floor(idx / 10) * 140;
                  const categoryValue = tableCategories[idx] || '';
                  return (
                    <div
                      key={idx}
                      onMouseDown={e => handleTableMouseDown(e, idx)}
                      onMouseEnter={() => setHoveredTableIdx(idx)}
                      onMouseLeave={() => setHoveredTableIdx(prev => (prev === idx ? null : prev))}
                      style={{ position: 'absolute', left, top }}
                    >
                      <TableVisual
                        table={table}
                        isDragging={draggedElementType === 'table' && draggedElementId === idx}
                        isViewer={isViewer}
                        onMouseDown={() => {}}
                        style={{ position: 'relative', zIndex: 1 }}
                        label={(categoryValue || '').toString()}
                        tableNumber={table.table_number || idx + 1}
                        guests={table.guests || []}
                      />
                      {false && (
                        <select
                          value={categoryValue}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setTableCategories(prev => { const arr = [...prev]; arr[idx] = e.target.value; return arr; })}
                          title="בחר קטגוריה"
                          style={{
                  position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            minWidth: 120,
                            height: 32,
                            opacity: hoveredTableIdx === idx ? 1 : 0,
                            pointerEvents: hoveredTableIdx === idx ? 'auto' : 'none',
                            background: hoveredTableIdx === idx ? 'rgba(255,255,255,0.96)' : 'transparent',
                            border: hoveredTableIdx === idx ? '1px solid #e2e8f0' : 'none',
                            borderRadius: 8,
                            padding: hoveredTableIdx === idx ? '6px 8px' : 0,
                            color: '#0f172a',
                            fontSize: 12,
                            zIndex: 30,
                            cursor: 'pointer',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            appearance: 'none'
                          }}
                        >
                          <option value="">בחר קטגוריה</option>
                          {availableCategories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 