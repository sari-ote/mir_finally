import React, { useEffect, useRef, useState } from 'react';
import TableVisual from './TableVisual';
import { useDrop, useDrag } from 'react-dnd';
import { getHallElementConfig } from './hallElementTypes';

export default function HallMapInline({ eventId, hallType = 'm', tables = [], hallElements: hallElementsProp = [], height = 600, availableCategories = [], canEditCategories = false, onChangeTableCategory = () => {}, onDropGuestToTable = () => {}, onDropCategory = () => {}, onAddSeat = () => {}, onRemoveSeat = () => {}, onRemoveGuestFromTable = () => {}, fitToView = false }) {
  const mapRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panInfo = useRef({ isPanning: false, startMouseX: 0, startMouseY: 0, startPanX: 0, startPanY: 0 });
  const [hallElements, setHallElements] = useState([]);
  
  // Use hallElements from props if provided, otherwise use local state
  const effectiveHallElements = hallElementsProp.length > 0 ? hallElementsProp : hallElements;
  const [displayElements, setDisplayElements] = useState([]);
  const [contentSize, setContentSize] = useState({ width: 1600, height: 1000 });
  const [hoveredTableIdx, setHoveredTableIdx] = useState(null);
  const [menu, setMenu] = useState({ open: false, x: 0, y: 0, tableId: null });
  const [guestsList, setGuestsList] = useState({ open: false, tableId: null, table: null });

  // גודל שולחן אחיד לכל האולמות
  const TABLE_SIZE = 120; // גודל אחיד לכל האולמות
  const MARGIN = 60;

  const getElementDefaults = (type) => {
    const cfg = getHallElementConfig(type);
    const isStageFamily = cfg.family === 'stage';
    return {
      width: cfg.width || (isStageFamily ? 1200 : 300),
      height: cfg.height || (isStageFamily ? 200 : 120),
      color: cfg.color || '#34d399',
      label: cfg.label || 'אלמנט',
      isStageFamily,
    };
  };

  const setZoomSafe = (val) => {
    const clamped = Math.min(3, Math.max(0.3, Number(val)));
    setZoom(Number(clamped.toFixed(2)));
  };
  const handleZoomIn = () => setZoomSafe(zoom + 0.1);
  const handleZoomOut = () => setZoomSafe(zoom - 0.1);

  const handleWheelZoom = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoomSafe(zoom + delta);
  };

  const handleMapMouseDown = (e) => {
    if (e.target === mapRef.current) {
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

  useEffect(() => {
    const fetchHallElements = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const url = `http://localhost:8001/tables/hall-elements/event/${eventId}?hall_type=${hallType}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setHallElements(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error('Failed to load hall elements:', e);
      }
    };
    fetchHallElements();
  }, [eventId, hallType]);

  // Close menu on outside click / ESC
  useEffect(() => {
    const onClick = (e) => {
      if (!menu.open) return;
      const menuEl = document.getElementById('table-menu-flyout');
      if (menuEl && !menuEl.contains(e.target)) setMenu({ open: false, x: 0, y: 0, tableId: null });
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenu({ open: false, x: 0, y: 0, tableId: null }); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [menu.open]);

  // Helpers for layout
  const rectsOverlap = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const elementRect = (el) => {
    const defaults = getElementDefaults(el.element_type);
    const w = Number(el.width) || defaults.width;
    const h = Number(el.height) || defaults.height;
    const x = Number(el.x) || 0;
    const y = Number(el.y) || 0;
    return { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h };
  };

  useEffect(() => {
    // Compute canvas size from tables
    const maxTableX = tables.length ? Math.max(...tables.map(t => (Number(t.x) || 0))) + TABLE_SIZE : 0;
    const maxTableY = tables.length ? Math.max(...tables.map(t => (Number(t.y) || 0))) + TABLE_SIZE : 0;
    let width = Math.max(1600, maxTableX + 4 * MARGIN);
    let height = Math.max(1000, maxTableY + 4 * MARGIN);

    // Build table rects
    const tableRects = tables.map(t => ({
      left: Number(t.x) || 0,
      top: Number(t.y) || 0,
      right: (Number(t.x) || 0) + TABLE_SIZE,
      bottom: (Number(t.y) || 0) + TABLE_SIZE
    }));

    // Auto-place hall elements if overlapping tables or each other
    const placed = [];
    const isFree = (rect) => {
      const collideTable = tableRects.some(tr => rectsOverlap(rect, tr));
      if (collideTable) return false;
      const collidePlaced = placed.some(pr => rectsOverlap(rect, pr));
      return !collidePlaced;
    };

    const tryPlace = (w, h, preferred) => {
      const startX = preferred?.x ?? MARGIN;
      const startY = preferred?.y ?? MARGIN;
      const step = 40;
      for (let y = startY; y + h + MARGIN < height; y += step) {
        for (let x = startX; x + w + MARGIN < width; x += step) {
          const rect = { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h };
          if (isFree(rect)) return rect;
        }
      }
      // If no free spot in current canvas, extend and place
      const rect = { left: width - w - MARGIN, top: height - h - MARGIN, right: width - MARGIN, bottom: height - MARGIN, width: w, height: h };
      return rect;
    };

    // Sort by priority (stage family first)
    const sorted = [...effectiveHallElements].sort((a, b) => {
      const pa = getHallElementConfig(a.element_type).priority ?? 99;
      const pb = getHallElementConfig(b.element_type).priority ?? 99;
      return pa - pb;
    });
    const placedElements = sorted.map(raw => {
      const el = { ...raw };
      const defaults = getElementDefaults(el.element_type);
      const w = Number(el.width) || defaults.width;
      const h = Number(el.height) || defaults.height;
      
      // השתמש במיקום המקורי מהשרת - לא לסדר מחדש
      const x = Number(el.x) || 0;
      const y = Number(el.y) || 0;
      
      return { ...el, x, y, width: w, height: h };
    });

    // Ensure canvas large enough for placed elements
    const maxElRight = placedElements.length ? Math.max(...placedElements.map(r => r.x + r.width)) : 0;
    const maxElBottom = placedElements.length ? Math.max(...placedElements.map(r => r.y + r.height)) : 0;
    width = Math.max(width, maxElRight + 2 * MARGIN);
    height = Math.max(height, maxElBottom + 2 * MARGIN);

    setDisplayElements(placedElements);
    setContentSize({ width, height });
    setPan({ x: 0, y: 0 });
  }, [effectiveHallElements, tables, hallType]);

  // Effect לזום אוטומטי - רץ פעם אחת כשיש נתונים
  const [initialZoomSet, setInitialZoomSet] = useState(false);
  
  useEffect(() => {
    // אם כבר הוגדר זום ראשוני או אם fitToView לא מופעל, לא עושים כלום
    if (initialZoomSet || !fitToView) {
      if (!fitToView && !initialZoomSet) {
        setZoomSafe(1);
        setInitialZoomSet(true);
      }
      return;
    }
    
    // חכה שה-ref יהיה מוכן ושיש תוכן
    if (!mapRef.current || contentSize.width <= 0 || contentSize.height <= 0) {
      return;
    }
    
    const timer = setTimeout(() => {
      const containerWidth = mapRef.current?.clientWidth || 800;
      const containerHeight = mapRef.current?.clientHeight || 600;
      const scaleX = containerWidth / contentSize.width;
      const scaleY = containerHeight / contentSize.height;
      const fitZoom = Math.min(scaleX, scaleY) * 0.8; // 80% מהמקסימום כדי להשאיר שוליים
      const safeZoom = isNaN(fitZoom) || !isFinite(fitZoom) ? 0.5 : fitZoom;
      const finalZoom = Math.max(0.3, Math.min(1, safeZoom));
      console.log('Setting initial zoom:', { containerWidth, containerHeight, contentSize, fitZoom, finalZoom });
      setZoomSafe(finalZoom);
      setInitialZoomSet(true);
    }, 200);
    
    return () => clearTimeout(timer);
  }, [fitToView, contentSize, initialZoomSet]);

  // Draggable guest chip
  const GuestChip = ({ guest }) => {
    // לוג לבדיקה
    console.log('GuestChip rendering:', { id: guest?.id, guest });
    
    const [{ isDragging }, drag] = useDrag(() => ({
      type: 'GUEST',
      item: { ...guest },
      canDrag: true, // תמיד מאפשר גרירה
      collect: (monitor) => ({ isDragging: !!monitor.isDragging() })
    }), [guest?.id, guest]);
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
      (guest.id ? `#${guest.id}` : 'ללא שם')
    );
    return (
      <span
        ref={drag}
        style={{
          display: 'inline-block',
          background: isDragging ? '#4f8cff' : '#fff',
          color: isDragging ? '#fff' : '#222',
          borderRadius: 12,
          padding: '2px 8px',
          margin: '0 4px 4px 0',
          fontSize: 11,
          boxShadow: '0 1px 3px #0002',
          cursor: 'grab',
          border: '1px solid #cfe1ff'
        }}
      >
        {displayName}
      </span>
    );
  };

  // Child component to satisfy hooks rules
  const TableCell = ({ table }) => {
    const [hover, setHover] = useState(false);
    const left = table.x ?? 40;
    const top = table.y ?? 40;
    const categoryValue = table.category || '';

    const [{ isOver }, drop] = useDrop(() => ({
      accept: ['CATEGORY', 'GUEST'],
      drop: (item) => {
        if (item?.category) {
          onChangeTableCategory(table.id, item.category);
          onDropCategory(table, item.category);
        } else if (item?.id) {
          onDropGuestToTable(table, item);
        }
      },
      collect: (monitor) => ({ isOver: !!monitor.isOver() })
    }), [table.id, categoryValue, onChangeTableCategory, onDropCategory, onDropGuestToTable]);

    const [{ isDragging }, drag] = useDrag(() => ({
      type: 'TABLE_CATEGORY',
      item: { tableId: table.id, category: categoryValue },
      canDrag: () => Boolean(categoryValue),
      collect: (monitor) => ({ isDragging: !!monitor.isDragging() })
    }), [table.id, categoryValue]);

    const openMenu = (e) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setMenu({ open: true, x: rect.left + rect.width / 2, y: rect.top, tableId: table.id });
    };

    return (
      <div
        ref={drop}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={openMenu}
        style={{ position: 'absolute', left, top }}
      >
        {/* Category visual handled within TableVisual */}

        {/* Fixed-size table box to anchor badges inside the table */}
        <div style={{ position: 'relative', width: TABLE_SIZE, height: TABLE_SIZE }}>
          <TableVisual
            table={{ ...table, size: Number(table.size) }}
            guests={Array.isArray(table.guests) ? table.guests : []}
            isDragging={false}
            isViewer={true}
            onMouseDown={() => {}}
            style={{ position: 'relative', zIndex: 1, outline: isOver ? '3px dashed #10b981' : 'none', outlineOffset: 2, cursor: 'pointer' }}
            label={`${table.occupied || 0}/${table.size}`}
            categoryLabel={categoryValue}
            tableNumber={table.table_number || table.id}
            hallType={hallType}
            onRemoveGuest={(guest) => onRemoveGuestFromTable(table, guest)}
          />

          {/* Overflow indicator: show +N inside the table (top-right) */}
          {Number(table.occupied || 0) > Number(table.size || 0) && (
            <div className="table-overflow-indicator">
              {`+${Number(table.occupied) - Number(table.size)}`}
            </div>
          )}
        </div>
      </div>
    );
  };

  const MenuFlyout = () => {
    if (!menu.open || !menu.tableId) return null;
    const currentTable = tables.find(t => t.id === menu.tableId);
    return (
      <div className="table-menu-flyout" style={{ left: menu.x, top: menu.y - 8 }}>
        <div className="table-menu-header">תפריט שולחן</div>
        <button onClick={() => { setGuestsList({ open: true, tableId: menu.tableId, table: currentTable }); setMenu({ open: false, x: 0, y: 0, tableId: null }); }} className="table-menu-item">
          <span className="table-menu-icon guests">👥</span>
          <span className="table-menu-text">הצגת המוזמנים</span>
        </button>
        <button onClick={() => { onAddSeat(menu.tableId); setMenu({ open: false, x: 0, y: 0, tableId: null }); }} className="table-menu-item">
          <span className="table-menu-icon add">+</span>
          <span className="table-menu-text">הוספת כיסא</span>
        </button>
        <button onClick={() => { onRemoveSeat(menu.tableId); setMenu({ open: false, x: 0, y: 0, tableId: null }); }} className="table-menu-item">
          <span className="table-menu-icon remove">-</span>
          <span className="table-menu-text">הורדת כיסא</span>
        </button>
        {canEditCategories && (
          <div className="table-menu-category-section">
            <div className="table-menu-category-label">בחירת קטגוריה</div>
            <select onChange={(e) => { onChangeTableCategory(menu.tableId, e.target.value); setMenu({ open: false, x: 0, y: 0, tableId: null }); }} defaultValue="" className="table-menu-category-select">
              <option value="">ללא</option>
              {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>
    );
  };

  const getDisplayName = (guest) => (
    guest?.full_name ||
    guest?.name ||
    guest?.["שם מלא"] ||
    [guest?.["שם"], guest?.["שם משפחה"]].filter(Boolean).join(' ') ||
    [guest?.["שם פרטי"], guest?.["שם משפחה"]].filter(Boolean).join(' ') ||
    [guest?.first_name, guest?.last_name].filter(Boolean).join(' ') ||
    [guest?.firstName, guest?.lastName].filter(Boolean).join(' ') ||
    guest?.["טלפון"] ||
    guest?.phone ||
    (guest?.id ? `#${guest.id}` : '')
  );

  const GuestsListModal = () => {
    if (!guestsList.open || !guestsList.table) return null;
    
    const table = guestsList.table;
    const guests = Array.isArray(table.guests) ? table.guests : [];
    const chairCount = Math.max(1, Number(table.size) || 12);
    const safeTableNumber = table.table_number || table.id;

    return (
      <div 
        className="modal-overlay"
        onClick={() => setGuestsList({ open: false, tableId: null, table: null })}
      >
        <div 
          className="modal-container"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h4 className="modal-title">
              הצגת המוזמנים לשולחן {safeTableNumber}
            </h4>
            <button
              className="modal-close-button"
              onClick={() => setGuestsList({ open: false, tableId: null, table: null })}
            >
              ✕
            </button>
          </div>
          
          <div className="modal-content">
            {guests && guests.length > 0 ? (
              guests.map((guest, index) => (
                <div key={guest?.id || index} className="guest-list-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="guest-number">
                    {index + 1}
                  </span>
                  <GuestChip guest={guest} />
                  <div className="guest-info" style={{ flex: 1 }}>
                    {guest?.phone && (
                      <div className="guest-contact">
                        📞 {guest.phone}
                      </div>
                    )}
                    {guest?.email && (
                      <div className="guest-contact">
                        ✉️ {guest.email}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">🪑</div>
                <div className="empty-state-title">אין מוזמנים בשולחן זה</div>
                <div className="empty-state-subtitle">השולחן ריק</div>
              </div>
            )}
          </div>
          
          <div className="modal-footer">
            <div className="modal-stats">
              <span className="modal-stat">
                סה"כ מוזמנים: <span className="modal-stat-value">{guests.length}</span>
              </span>
              <span className="modal-stat">
                מקומות פנויים: <span className="modal-stat-value accent">{chairCount - guests.length}</span>
              </span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-bar-fill"
                style={{ width: `${Math.min(100, (guests.length / chairCount) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="hall-map-container" style={{ height }}>
      <div className="zoom-controls">
        <button onClick={handleZoomOut} className="zoom-button">-</button>
        <span className="zoom-display">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} className="zoom-button">+</button>
      </div>
      <div 
        ref={mapRef}
        className="map-viewport"
        onWheel={handleWheelZoom}
        onMouseDown={handleMapMouseDown}
      >
        <div
          style={{ position: 'absolute', left: 0, top: 0, width: `${contentSize.width}px`, height: `${contentSize.height}px`, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          {/* Grid background */}
          <div className="grid-background" />

          {/* Hall elements (auto-placed, read-only) */}
          {displayElements.map((element) => {
            const defaults = getElementDefaults(element.element_type);
            return (
              <div
                key={element.id}
                className={`hall-element ${element.element_type}`}
                style={{
                  left: element.x || 100,
                  top: element.y || 100,
                  width: element.width || defaults.width,
                  height: element.height || defaults.height,
                  background: defaults.color,
                  borderRadius: defaults.isStageFamily ? '12px' : '6px',
                  fontSize: defaults.isStageFamily ? '24px' : '16px',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                  transform: element.rotation ? `rotate(${element.rotation}deg)` : 'none'
                }}
              >
                <div>{element.name || defaults.label}</div>
              </div>
            );
          })}

          {/* Tables with category selector and DnD */}
          {tables.map((table) => (
            <TableCell key={table.id || `${table.x}-${table.y}`} table={table} />
          ))}
        </div>
        <MenuFlyout />
        <GuestsListModal />
      </div>
    </div>
  );
} 