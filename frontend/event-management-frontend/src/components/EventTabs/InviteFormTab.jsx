// InviteFormTab.jsx
import React, { useState, useEffect } from "react";
import NewDonorsForm from "./forms/NewDonorsForm.jsx";
import WomenSeatingUpdateForm from "./forms/WomenSeatingUpdateForm.jsx";
import AddGuestsForm from "./forms/AddGuestsForm.jsx";
import IncreaseSddForm from "./forms/IncreaseSddForm.jsx";
import VipRegistrationForm from "./forms/VipRegistrationForm.jsx";
import CopyIcon from "../ui/CopyIcon";
import "../../styles/theme-tropical.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8001";
const PUBLIC_BASE = process.env.REACT_APP_PUBLIC_BASE_URL || window.location.origin;

const defaultFields = [
  { name: "שם" },
  { name: "שם משפחה" },
  { name: "תעודת זהות" },
  { name: "טלפון" },
  { name: "אימייל" },
  { name: "מגדר" },
  { name: "בא עם בן/ת זוג?" },
  { name: "עדיפות למקום ישיבה" },
  { name: "מי הביא אותך?" },
  { name: 'הגדלת הו"ק חודשית ב:', options: ["300₪", "400₪", "500₪", "600₪", "700₪", "800₪", "900₪", "אחר"] },
  { name: 'עדכון השתתפות נשים דינר פ"נ *', options: [
    "השתתפות יחידה נשים",
    "לא משתתפת אחר",
    "לא משתתפת חו\"ל",
    "לא משתתפת עם משפחתית",
    "ספק"
  ] },
  { name: 'עדכון השתתפות גברים דינר פ"נ *', options: [
    "השתתפות יחיד",
    "לא משתתף אחר",
    "לא משתתף חו\"ל",
    "לא משתתף עם משפחתית",
    "ספק"
  ] },
  { name: "ברכה בספר הברכות" },
  { name: "הבאת אורח/ת נוסף/ת" },
  { name: "ליד מי תרצו לשבת? (משתתף ראשי)" },
];

// הגדרת 5 סוגי טפסים
const FORM_TABS = [
  { key: "new-donors", label: "תורמים חדשים", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  )},
  { key: "women-seating-update", label: "עדכון הושבה נשים", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" ry="2"></rect>
      <line x1="3" y1="10" x2="21" y2="10"></line>
      <path d="M8 15h.01M12 15h.01M16 15h.01"></path>
    </svg>
  )},
  { key: "add-guests", label: "הוספת אורחים", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  )},
  { key: "increase-sdd", label: "הגדלת הו\"ק", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
      <polyline points="17 6 23 6 23 12"></polyline>
    </svg>
  )},
  { key: "vip-registration", label: "רישום VIP", icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  )},
];

function InviteFormTab({ eventId }) {
  console.log('InviteFormTab: eventId from props:', eventId);
  const getInitialFormFromUrl = () => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const f = sp.get('form');
      return FORM_TABS.some(t => t.key === f) ? f : FORM_TABS[0].key;
    } catch {
      return FORM_TABS[0].key;
    }
  };
  const [activeForm, setActiveForm] = useState(getInitialFormFromUrl());
  // תרומה: מצב ספציפי ל"תורמים חדשים"
  const [donationAmount, setDonationAmount] = useState(0);
  const [isRecurring, setIsRecurring] = useState(false);
  const [months, setMonths] = useState(24);
  const [currency, setCurrency] = useState('ILS');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentTab, setPaymentTab] = useState('credit'); // 'credit' | 'bank'

  // שדות וטופס לפי סוג
  const [fieldsByForm, setFieldsByForm] = useState(() => {
    const map = {};
    FORM_TABS.forEach(t => { map[t.key] = []; });
    return map;
  });
  const [newField, setNewField] = useState("");
  const [newFieldType, setNewFieldType] = useState('text');
  const [logoUrl, setLogoUrl] = useState(null);
  const [formDataByForm, setFormDataByForm] = useState(() => {
    const map = {};
    FORM_TABS.forEach(t => { map[t.key] = {}; });
    return map;
  });
  const [shareToken, setShareToken] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState(null);

  const fields = fieldsByForm[activeForm] || [];
  const formData = formDataByForm[activeForm] || {};

  const role = localStorage.getItem("role");
  const isManager = role === "admin" || role === "event_admin";
  
  useEffect(() => {
    async function loadFields() {
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_BASE}/guests/events/${eventId}/form-fields?form_key=${activeForm}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const serverFields = res.ok ? await res.json() : [];
        // Keep id, name, type to enable drag ordering
        setFieldsByForm(prev => ({ ...prev, [activeForm]: serverFields.map(f => ({ id: f.id, name: f.name, type: f.field_type })) }));
      } catch (e) { console.error('loadFields failed', e); }
    }
    if (eventId && activeForm) loadFields();
  }, [eventId, activeForm]);

  useEffect(() => {
    if (!eventId || !activeForm || !isManager) {
      setShareToken(null);
      setShareError(null);
      return;
    }
    const token = localStorage.getItem('access_token');
    if (!token) {
      setShareToken(null);
      return;
    }
    setShareLoading(true);
    setShareError(null);
    fetch(`${API_BASE}/guests/events/${eventId}/form-shares?form_key=${activeForm}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('load_failed')))
      .then(shares => {
        const current = Array.isArray(shares) ? shares.find(s => s.is_active) : null;
        setShareToken(current ? current.token : null);
      })
      .catch(() => {
        setShareError('שגיאה בטעינת קישור השיתוף');
        setShareToken(null);
      })
      .finally(() => {
        setShareLoading(false);
      });
  }, [eventId, activeForm, isManager]);

  const presetTiles = [
    { title: 'ידיד', amount: 250, per: 'לחודש × 24' },
    { title: 'מחזיק', amount: 360, per: 'לחודש × 24' },
    { title: 'תומך', amount: 500, per: 'לחודש' },
    { title: 'נועם נשאול', amount: 720, per: 'לחודש' },
    { title: 'שותף', amount: 1000, per: 'לחודש' },
    { title: 'זכות התורה אברך', amount: 1500, per: 'לחודש' },
    { title: 'זכות התורה חברותא', amount: 3000, per: 'לחודש' },
    { title: 'אוהב תורה', amount: 3600, per: 'לחודש' },
    { title: 'פרנס חברות י"ח עשרה ת"ח', amount: 18000, per: 'לחודש' },
    { title: 'פרנס חברות י"ח ת"ח', amount: 25000, per: 'לחודש' },
    { title: 'פרנס ההסעות ליום', amount: 36000 },
    { title: 'זכות בית המדרש', amount: 100000 },
  ];

  const DonationHeader = () => (
    <div className="tropical-card" style={{
      display: 'flex', 
      flexDirection: 'row',
      alignItems: 'center', 
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
      gap: 8,
      background: 'rgba(255, 255, 255, 0.95)', 
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(148, 163, 184, 0.3)', 
      borderRadius: '18px', 
      padding: '12px 16px',
      boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
      marginBottom: '20px',
      direction: 'rtl',
      width: '100%',
      boxSizing: 'border-box',
      overflowX: 'auto',
      overflowY: 'hidden'
    }}>
      <input
        type="number"
        min={0}
        value={donationAmount || ''}
        onChange={e => setDonationAmount(Number(e.target.value) || 0)}
        placeholder="הזנת סכום חופשי"
        className="tropical-input"
        style={{ 
          width: '180px', 
          minWidth: '180px',
          maxWidth: '180px',
          padding: '10px 14px', 
          borderRadius: '999px', 
          border: '1px solid rgba(148, 163, 184, 0.6)', 
          background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
          fontWeight: 600, 
          textAlign: 'right',
          fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: '0.9rem',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
          direction: 'rtl',
          flexShrink: 0,
          boxSizing: 'border-box',
          margin: 0
        }}
      />
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '3px',
        background: 'rgba(242, 242, 247, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: '999px',
        padding: '3px',
        border: 'none',
        boxShadow: 'none',
        flexShrink: 0
      }}>
        <button
          type="button"
          onClick={() => setCurrency('ILS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '50px',
            height: '38px',
            borderRadius: '999px',
            border: 'none',
            background: currency === 'ILS' 
              ? '#ffffff' 
              : 'transparent',
            color: currency === 'ILS' 
              ? '#09b0cb' 
              : 'rgba(142, 142, 147, 0.8)',
            fontWeight: 500,
            fontSize: '1.15rem',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            boxShadow: 'none',
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            WebkitTapHighlightColor: 'transparent',
            outline: 'none'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.96)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseEnter={(e) => {
            if (currency !== 'ILS') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (currency !== 'ILS') {
              e.currentTarget.style.background = 'transparent';
            }
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ₪
        </button>
        <button
          type="button"
          onClick={() => setCurrency('USD')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '50px',
            height: '38px',
            borderRadius: '999px',
            border: 'none',
            background: currency === 'USD' 
              ? '#ffffff' 
              : 'transparent',
            color: currency === 'USD' 
              ? '#09b0cb' 
              : 'rgba(142, 142, 147, 0.8)',
            fontWeight: 500,
            fontSize: '1.15rem',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            boxShadow: 'none',
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            WebkitTapHighlightColor: 'transparent',
            outline: 'none'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.96)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseEnter={(e) => {
            if (currency !== 'USD') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (currency !== 'USD') {
              e.currentTarget.style.background = 'transparent';
            }
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          $
        </button>
      </div>
      <label style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: 6, 
        cursor: 'pointer', 
        fontSize: '0.9rem', 
        color: 'var(--color-text-main, #10131A)', 
        fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        whiteSpace: 'nowrap',
        flexShrink: 0,
        margin: 0
      }}>
        <input 
          type="checkbox" 
          checked={isRecurring} 
          onChange={e => setIsRecurring(e.target.checked)}
          style={{ 
            width: '16px', 
            height: '16px', 
            cursor: 'pointer',
            accentColor: 'var(--color-primary, #09b0cb)',
            flexShrink: 0,
            margin: 0
          }} 
        />
        <span>הוראת קבע למשך</span>
      </label>
      <select disabled={!isRecurring} value={months} onChange={e => setMonths(Number(e.target.value))} className="tropical-input"
        style={{ 
          padding: '10px 12px', 
          borderRadius: '999px', 
          border: '1px solid rgba(148, 163, 184, 0.6)', 
          background: isRecurring ? 'linear-gradient(to bottom, #ffffff, #f8fafc)' : 'rgba(148, 163, 184, 0.1)',
          width: '47px',
          minWidth: '47px',
          maxWidth: '47px',
          fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: '0.9rem',
          cursor: isRecurring ? 'pointer' : 'not-allowed',
          opacity: isRecurring ? 1 : 0.6,
          flexShrink: 0,
          boxSizing: 'border-box',
          margin: 0
        }}>
        {[12, 18, 24, 36].map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <span style={{ 
        fontSize: '0.9rem', 
        color: 'var(--color-text-main, #10131A)', 
        fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        whiteSpace: 'nowrap',
        flexShrink: 0,
        margin: 0
      }}>
        חודשים
      </span>
    </div>
  );

  // Unified input style to match Tropical theme
  const fieldInputStyle = { 
    width: '100%', 
    padding: '14px 18px', 
    borderRadius: '999px', 
    border: '1px solid rgba(148, 163, 184, 0.6)', 
    background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
    fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: '0.95rem',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
    transition: 'all 0.2s ease'
  };

  const DonationTiles = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 16,
      marginTop: 14
    }}>
      {presetTiles.map((t, i) => {
        const selected = donationAmount === t.amount;
        return (
          <button 
            key={i} 
            onClick={() => setDonationAmount(t.amount)}
            className="tropical-card"
            style={{
              textAlign: 'center', 
              background: selected 
                ? 'rgba(8, 200, 230, 0.15)' 
                : 'rgba(255, 255, 255, 0.95)', 
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '18px',
              border: selected 
                ? '2px solid rgba(8, 200, 230, 0.95)' 
                : '1px solid rgba(148, 163, 184, 0.3)',
              padding: 20, 
              minHeight: 140, 
              boxShadow: selected 
                ? '0 8px 24px rgba(8, 200, 230, 0.25), 0 4px 12px rgba(8, 200, 230, 0.15)' 
                : '0 4px 12px rgba(15, 23, 42, 0.08)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            }}
            onMouseEnter={(e) => {
              if (!selected) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(8, 200, 230, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!selected) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
              }
            }}
          >
            <div style={{ 
              color: selected ? 'var(--color-primary, #09b0cb)' : 'var(--color-text-secondary, #6B7280)', 
              marginBottom: 10, 
              fontWeight: 600,
              fontSize: '0.95rem'
            }}>
              {t.title}
            </div>
            <div style={{ 
              fontSize: 36, 
              fontWeight: 700,
              color: selected ? 'var(--color-primary, #09b0cb)' : 'var(--color-text-main, #10131A)',
              marginBottom: 4
            }}>
              ₪{t.amount.toLocaleString()}
            </div>
            {t.per && (
              <div style={{ 
                color: selected ? 'var(--color-primary, #09b0cb)' : 'var(--color-text-secondary, #6B7280)', 
                marginTop: 8,
                fontSize: '0.85rem',
                fontWeight: 500
              }}>
                {t.per}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  const PaymentPanel = () => (
    <div className="tropical-card" style={{ 
      marginTop: 24, 
      background: 'rgba(255, 255, 255, 0.95)', 
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(148, 163, 184, 0.3)', 
      borderRadius: '20px', 
      padding: 24,
      boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)'
    }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button 
          onClick={() => setPaymentTab('credit')} 
          className={paymentTab === 'credit' ? 'tropical-button-primary' : 'tropical-button-secondary'}
          style={{
            padding: '12px 20px', 
            borderRadius: '999px', 
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.95rem',
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            transition: 'all 0.2s ease'
          }}
        >
          אשראי
        </button>
        <button 
          onClick={() => setPaymentTab('bank')} 
          className={paymentTab === 'bank' ? 'tropical-button-primary' : 'tropical-button-secondary'}
          style={{
            padding: '12px 20px', 
            borderRadius: '999px', 
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.95rem',
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            transition: 'all 0.2s ease'
          }}
        >
          העברה בנקאית
        </button>
      </div>
      {paymentTab === 'credit' ? (
        <div style={{ display: 'grid', gap: 16, maxWidth: 820 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ 
                display: 'block', 
                marginBottom: 8, 
                fontWeight: 600, 
                fontSize: '0.95rem',
                color: 'var(--color-text-main, #10131A)',
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              }}>
                מספר כרטיס אשראי:
              </label>
              <input 
                placeholder="XXXX XXXX XXXX XXXX" 
                className="tropical-input"
                style={{ 
                  width: '100%', 
                  padding: '14px 18px', 
                  borderRadius: '999px', 
                  border: '1px solid rgba(148, 163, 184, 0.6)',
                  background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '0.95rem',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)'
                }} 
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ 
                display: 'block', 
                marginBottom: 8, 
                fontWeight: 600, 
                fontSize: '0.95rem',
                color: 'var(--color-text-main, #10131A)',
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              }}>
                תוקף:
              </label>
              <input 
                placeholder="MM/YY" 
                className="tropical-input"
                style={{ 
                  width: '100%', 
                  padding: '14px 18px', 
                  borderRadius: '999px', 
                  border: '1px solid rgba(148, 163, 184, 0.6)',
                  background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '0.95rem',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)'
                }} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ 
                display: 'block', 
                marginBottom: 8, 
                fontWeight: 600, 
                fontSize: '0.95rem',
                color: 'var(--color-text-main, #10131A)',
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              }}>
                3 ספרות בגב הכרטיס:
              </label>
              <input 
                placeholder="CVV" 
                className="tropical-input"
                style={{ 
                  width: '100%', 
                  padding: '14px 18px', 
                  borderRadius: '999px', 
                  border: '1px solid rgba(148, 163, 184, 0.6)',
                  background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  fontSize: '0.95rem',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)'
                }} 
              />
            </div>
          </div>
          <div style={{ 
            marginTop: 12, 
            fontWeight: 700, 
            textAlign: 'center',
            fontSize: '1.1rem',
            color: 'var(--color-text-main, #10131A)',
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            padding: '16px',
            background: 'rgba(8, 200, 230, 0.08)',
            borderRadius: '14px'
          }}>
            סה"כ לתשלום: {isRecurring ? `₪${donationAmount.toLocaleString()} לחודש` : `₪${donationAmount.toLocaleString()} חד פעמי`} {isRecurring ? ` למשך ${months} חודשים` : ''}
          </div>
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button 
              type="button" 
              className="tropical-button-primary"
              style={{ 
                padding: '14px 32px', 
                borderRadius: '999px', 
                fontWeight: 600, 
                fontSize: '1rem',
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                cursor: 'pointer',
                minWidth: '160px'
              }}
            >
              תשלום
            </button>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 720 }}>
          <div className="tropical-card" style={{ 
            background: 'rgba(255, 255, 255, 0.95)', 
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(148, 163, 184, 0.3)', 
            borderRadius: '18px', 
            padding: 20, 
            marginBottom: 16,
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: '0.95rem',
            color: 'var(--color-text-main, #10131A)',
            lineHeight: 1.6
          }}>
            להשלמת ההרשמה נא לבצע העברה בנקאית לישיבה. בלחיצה על "אישור", תיווצר התחייבות לתשלום מול הארגון ויש ליצור קשר עם הארגון להשלמת ההעברה ועבור קבלה.
          </div>
          <div style={{ textAlign: 'center' }}>
            <button 
              type="button" 
              className="tropical-button-primary"
              style={{ 
                padding: '14px 32px', 
                borderRadius: '999px', 
                fontWeight: 600, 
                fontSize: '1rem',
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                cursor: 'pointer',
                minWidth: '160px'
              }}
            >
              אישור
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const handleAddField = () => {
    if (!newField.trim()) return;
  
    const body = {
      field_name: newField,
      field_type: newFieldType,
      form_key: activeForm,
    };
  
    fetch(`${API_BASE}/guests/events/${eventId}/form-fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem('access_token')}` },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .then((data) => {
        setFieldsByForm(prev => ({
          ...prev,
          [activeForm]: [...(prev[activeForm] || []), { id: data.id, name: data.name, type: data.field_type }]
        }));
        setNewField("");
      })
      .catch((err) => {
        console.error("שגיאה בהוספת שדה:", err);
      });
  };

  // Drag & drop reorder
  const [dragIndex, setDragIndex] = useState(null);
  const onDragStart = (index) => setDragIndex(index);
  const onDragOver = (e, index) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setFieldsByForm(prev => {
      const list = [...(prev[activeForm] || [])];
      const [moved] = list.splice(dragIndex, 1);
      list.splice(index, 0, moved);
      setDragIndex(index);
      return { ...prev, [activeForm]: list };
    });
  };
  const onDragEnd = async () => {
    setDragIndex(null);
    try {
      const token = localStorage.getItem('access_token');
      const ids = (fieldsByForm[activeForm] || []).map(f => f.id).filter(Boolean);
      await fetch(`${API_BASE}/guests/events/${eventId}/form-fields/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ form_key: activeForm, ordered_ids: ids })
      });
    } catch (e) { console.error('reorder failed', e); }
  };

  function handleRemoveField(index) {
    setFieldsByForm(prev => {
      const updated = [...(prev[activeForm] || [])];
      updated.splice(index, 1);
      return { ...prev, [activeForm]: updated };
    });
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  function handleInputChange(name, value) {
    setFormDataByForm(prev => ({
      ...prev,
      [activeForm]: { ...(prev[activeForm] || {}), [name]: value }
    }));
  }

  function isValidIsraeliID(id) {
    id = String(id).trim();
    if (id.length > 9 || id.length < 5 || isNaN(id)) return false;
    id = id.padStart(9, '0');
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let num = Number(id[i]) * ((i % 2) + 1);
      if (num > 9) num -= 9;
      sum += num;
    }
    return sum % 10 === 0;
  }
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  const handleSubmit = async () => {
    try {
      if (!isValidIsraeliID(formData["תעודת זהות"])) {
        alert("תעודת זהות לא תקינה");
        return;
      }
      if (!isValidEmail(formData["אימייל"])) {
        alert("אימייל לא תקין");
        return;
      }
      if (!formData["מגדר"]) {
        alert("יש לבחור מגדר");
        return;
      }
      const payload = {
        event_id: parseInt(eventId),
        first_name: formData["שם"] || "",
        last_name: formData["שם משפחה"] || "",
        id_number: formData["תעודת זהות"] || "",
        address: "",
        phone: formData["טלפון"] || "",
        email: formData["אימייל"] || "",
        referral_source: formData["מי הביא אותך?"] || "",
        gender: formData["מגדר"] === "זכר" ? "male" : formData["מגדר"] === "נקבה" ? "female" : null
      };

      const guestResponse = await fetch(`${API_BASE}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem('access_token')}` },
        body: JSON.stringify(payload)
      });

      if (!guestResponse.ok) {
        let msg = "שגיאה בהוספת מוזמן";
        try {
          const data = await guestResponse.json();
          if (data.detail) {
            if (Array.isArray(data.detail)) {
              msg = data.detail.map(d => d.msg).join(", ");
            } else if (typeof data.detail === "string") {
              msg = data.detail;
            }
          }
        } catch {}
        alert(msg);
        return;
      }

      const guest = await guestResponse.json();
      if (!guest.id) throw new Error("שמירת האורח נכשלה");

      const fieldValueRequests = Object.entries(formData).map(([field_name, value]) => {
        return fetch(`${API_BASE}/guests/events/${eventId}/guests/${guest.id}/field-values`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem('access_token')}` },
          body: JSON.stringify({ field_name, value }),
        });
      });

      await Promise.all(fieldValueRequests);

      alert("ההזמנה נשלחה בהצלחה!");
      setFormDataByForm(prev => ({ ...prev, [activeForm]: {} }));

    } catch (error) {
      console.error("שגיאה בשליחה:", error);
      alert(error.message || "אירעה שגיאה בשליחה");
    }
  };

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('form', activeForm);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [activeForm]);

  const shareLink = shareToken ? `${PUBLIC_BASE}/public/forms/${shareToken}` : "";

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      alert('קישור הועתק');
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  const createShareLink = async () => {
    if (!isManager) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      setShareError('נדרש להתחבר מחדש למערכת');
      return;
    }
    setShareLoading(true);
    setShareError(null);
    try {
      const res = await fetch(`${API_BASE}/guests/events/${eventId}/form-shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ form_key: activeForm, allow_submissions: true, deactivate_existing: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'יצירת הקישור נכשלה');
      }
      const share = await res.json();
      setShareToken(share.token);
    } catch (error) {
      console.error('create share failed', error);
      setShareError(error.message || 'שגיאה בייצור הקישור');
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="theme-tropical" style={{ background: "transparent", padding: "24px", borderRadius: "20px" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h3 className="tropical-section-title" style={{ margin: 0, fontWeight: 700, fontSize: "1.5rem", color: "var(--color-text-main, #10131A)" }}>הגדרת טופס הזמנה</h3>
        {isManager && (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={createShareLink}
                disabled={shareLoading}
                className="tropical-button-primary"
                style={{
                  cursor: shareLoading ? 'wait' : 'pointer',
                }}
              >
                {shareToken ? 'צור קישור חדש' : 'צור קישור שיתוף'}
              </button>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <input
                  readOnly
                  value={shareLink}
                  placeholder="אין קישור פעיל"
                  className="tropical-input"
                  style={{ 
                    width: 360, 
                    padding: '12px 16px 12px 52px', 
                    border: '1px solid rgba(148, 163, 184, 0.6)', 
                    borderRadius: '999px', 
                    background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
                    color: shareLink ? 'var(--color-text-main, #111827)' : 'var(--color-text-secondary, #6B7280)',
                    fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    fontSize: '0.95rem',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
                    transition: 'all 0.2s ease',
                    direction: 'rtl',
                  }}
                />
                {shareToken && (
                  <button
                    onClick={copyShareLink}
                    className="theme-tropical"
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary, #09b0cb)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-primary-dark, #067a8a)';
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-primary, #09b0cb)';
                      e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                    }}
                    title="העתק קישור"
                  >
                    <CopyIcon size={18} color="currentColor" />
                  </button>
                )}
              </div>
            </div>
            {(shareLoading || shareError) && (
              <div style={{ marginTop: 8, color: shareError ? 'red' : '#475569' }}>
                {shareError || 'יוצר קישור...'}
              </div>
            )}
          </>
        )}
      </div>

      {/* תתי-טאבים לטפסים */}
      <div className="tropical-filters" style={{ 
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'nowrap',
        gap: '8px',
        overflowX: 'auto',
        overflowY: 'hidden',
        width: '100%',
        alignItems: 'center'
      }}>
        {FORM_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveForm(tab.key); setShowPayment(false); }}
            className={`tropical-pill-filter ${activeForm === tab.key ? 'tropical-pill-filter--active' : ''}`}
            style={{
              flexShrink: 0,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {(() => {
        const isBuiltInForm = ['new-donors','women-seating-update','add-guests','increase-sdd','vip-registration'].includes(activeForm);
        if (isBuiltInForm) return null;
        return (
      <form>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {(fields || []).map((field, index) => (
          <div
            key={field.id || index}
            draggable={isManager}
            onDragStart={() => onDragStart(index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            style={{
              display: "flex",
              alignItems: "center",
              background: dragIndex === index ? '#eef2ff' : 'transparent',
              padding: 4, borderRadius: 6
            }}
          >
            {field.name === "מגדר" ? (
              <select
                required
                className="tropical-input"
                style={fieldInputStyle}
                value={formData["מגדר"] || ""}
                onChange={e => handleInputChange("מגדר", e.target.value)}
              >
                <option value="">בחר</option>
                <option value="זכר">זכר</option>
                <option value="נקבה">נקבה</option>
              </select>
            ) : field.options ? (
              <select
                className="tropical-input"
                style={fieldInputStyle}
                value={formData[field.name] || ""}
                onChange={e => handleInputChange(field.name, e.target.value)}
              >
                <option value="">בחר</option>
                {field.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'checkbox' ? (
              <input type="checkbox" checked={!!formData[field.name]} onChange={e => handleInputChange(field.name, e.target.checked)} style={{ width: 24, height: 24 }} />
            ) : field.type === 'number' ? (
              <input
                type="number"
                placeholder={field.name}
                style={fieldInputStyle}
                value={formData[field.name] || ""}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
              />
            ) : (
              <input
                type="text"
                placeholder={field.name}
                style={fieldInputStyle}
                value={formData[field.name] || ""}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
              />
            )}
            {isManager && (
              <button
                type="button"
                style={{ marginRight: "10px" }}
                onClick={() => handleRemoveField(index)}
                title="הסר שדה מהרשימה (לא מוחק מהשרת)"
              >
                ❌
              </button>
            )}
          </div>
        ))}
        {isManager && (
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="הוספת שדה"
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddField(); } }}
              style={{ ...fieldInputStyle, paddingLeft: 90 }}
            />
            {newField.trim() && (
              <button
                type="button"
                onClick={handleAddField}
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', padding: '6px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
              >
                שמור
              </button>
            )}
          </div>
        )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "6px",
          }}
        >
          שלח הזמנה
        </button>
      </form>
        );
      })()}
      {(activeForm === 'new-donors' || activeForm === 'women-seating-update' || activeForm === 'add-guests' || activeForm === 'increase-sdd' || activeForm === 'vip-registration') && (
        <div style={{ marginTop: 24 }}>
          {activeForm === 'new-donors' && <NewDonorsForm eventId={eventId} />}
          {activeForm === 'women-seating-update' && <WomenSeatingUpdateForm eventId={eventId} />}
          {activeForm === 'add-guests' && <AddGuestsForm eventId={eventId} />}
          {activeForm === 'increase-sdd' && <IncreaseSddForm eventId={eventId} />}
          {activeForm === 'vip-registration' && <VipRegistrationForm eventId={eventId} />}
        </div>
      )}
    </div>
  );
}

export default InviteFormTab;
export { InviteFormTab as InviteFormTabComponent };
