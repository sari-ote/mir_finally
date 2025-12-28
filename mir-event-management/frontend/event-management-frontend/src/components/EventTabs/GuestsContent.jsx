import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue, startTransition, memo } from "react";
import { useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import "../../styles/theme-tropical.css";

// פונקציית נורמליזציה לשדות - מחוץ לקומפוננטה כדי למנוע יצירה מחדש
const normKey = (s) =>
  String(s ?? "")
    .replace(/[\u200E\u200F\u202A-\u202E]/g, "") // bidi marks
    .replace(/\u00A0/g, " ")                    // NBSP
    .replace(/\s+/g, " ")
    .trim();

// מיפוי fallback לשדות - מחוץ לקומפוננטה כדי למנוע יצירה מחדש
const FIELD_FALLBACK = {
  // פרטים אישיים
  "תואר לפני": ["title_before", "תואר לפני"],
  "תואר אחרי": ["title_after", "תואר אחרי"],
  "שם פרטי": ["first_name", "שם פרטי"],
  "שם אמצעי": ["middle_name", "שם אמצעי"],
  "שם משפחה": ["last_name", "שם משפחה"],
  "שם אישה": ["wife_name", "שם אישה"],
  "תואר בן זוג": ["spouse_name", "תואר בן זוג"],
  "תואר אחרי בן זוג": ["title_after", "תואר אחרי בן זוג"],
  "גיל": ["age", "גיל"],
  "תאריך לידה": ["birth_date", "תאריך לידה"],
  "ת.ז./ח.פ.": ["id_number", "ת.ז./ח.פ.", "תעודת זהות"],
  "תעודת זהות": ["id_number", "תעודת זהות", "ת.ז./ח.פ."],
  "שפה": ["language", "שפה"],
  "מאפיינים": ["notes", "מאפיינים"],
  
  // פרטי קשר
  "מספר נייד": ["mobile_phone", "מספר נייד", "phone"],
  "טלפון בית": ["home_phone", "טלפון בית"],
  "טלפון נוסף": ["alt_phone_1", "טלפון נוסף"],
  "טלפון נוסף 2": ["alt_phone_2", "טלפון נוסף 2"],
  "Email": ["email", "Email", "אימייל", "מייל"],
  "אימייל": ["email", "אימייל", "Email", "מייל"],
  "מייל": ["email", "מייל", "Email", "אימייל"],
  "2 Email": ["email_2", "2 Email"],
  "טלפון אשה": ["wife_phone", "טלפון אשה"],
  
  // מזהים
  "מספר חשבון": ["account_number", "מספר חשבון"],
  "מספר אישי מניג'ר": ["manager_personal_number", "מספר אישי מניג'ר"],
  "CardID": ["card_id", "CardID"],
  
  // שיוך וניהול
  "קבוצה": ["groups", "קבוצה"],
  "קבוצה מייל": ["email_group", "קבוצה מייל"],
  "קישור למשתמש": ["user_link", "קישור למשתמש"],
  "מזהה שגריר": ["ambassador_id", "מזהה שגריר"],
  "שגריר": ["ambassador", "שגריר"],
  "שיוך לטלפנית": ["telephonist_assignment", "שיוך לטלפנית"],
  "בית כנסת": ["synagogue", "בית כנסת"],
  
  // טלפניות ושיחות
  "סטטוס זכאות ללידים": ["eligibility_status_for_leads", "סטטוס זכאות ללידים"],
  "ביקש לחזור בתאריך": ["requested_return_date", "ביקש לחזור בתאריך"],
  "שיחה אחרונה עם טלפנית": ["last_telephonist_call", "שיחה אחרונה עם טלפנית"],
  "סטטוס שיחה אחרונה": ["last_call_status", "סטטוס שיחה אחרונה"],
  "הערות": ["notes", "הערות"],
  "הערות טלפניות": ["telephonist_notes", "הערות טלפניות"],
  "תאור סטטוס": ["status_description", "תאור סטטוס"],
  
  // כתובת ראשית
  "רחוב": ["street", "רחוב"],
  "מספר בניין": ["building_number", "מספר בניין"],
  "מספר דירה": ["apartment_number", "מספר דירה"],
  "עיר": ["city", "עיר"],
  "שכונה": ["neighborhood", "שכונה"],
  "מיקוד": ["postal_code", "מיקוד", "zip_code"],
  "מדינה": ["country", "מדינה"],
  "ארץ": ["state", "ארץ"],
  "כתובת למשלוח דואר": ["mailing_address", "כתובת למשלוח דואר"],
  "שם לקבלה": ["recipient_name", "שם לקבלה"],
  
  // בנקים ותשלומים
  "שם בנק": ["bank", "שם בנק"],
  "סניף": ["branch", "סניף"],
  "מספר כרטיס אשראי": ["credit_card_number", "מספר כרטיס אשראי"],
  
  // תרומות
  "האם הוק פעיל": ["is_hok_active", "האם הוק פעיל"],
  "סכום הוק חודשי בש\"ח": ["monthly_hok_amount_nis", "סכום הוק חודשי בש\"ח"],
  "סכום תשלום אחרון": ["last_payment_amount", "סכום תשלום אחרון"],
  "סכום תרומות ותשלומים בשנה האחרונה": ["donations_payments_last_year", "סכום תרומות ותשלומים בשנה האחרונה"],
  "סכום תרומות ותשלומים סהכ": ["total_donations_payments", "סכום תרומות ותשלומים סהכ"],
  "התחייבות לתרומה": ["donation_commitment", "התחייבות לתרומה"],
  "יכולת תרומה": ["donation_ability", "יכולת תרומה"],
  
  // היסטוריית תרומות
  "תרומות בשנה האחרונה": ["donations_payments_last_year", "תרומות בשנה האחרונה"],
  
  // אירועים ודינרים
  "דינרים משתתפים": ["dinners_participated", "דינרים משתתפים"],
  "סטטוס חסות/ברכה": ["sponsorship_blessing_status", "סטטוס חסות/ברכה"],
  "תוכן הברכה דינר קודם": ["blessing_content_dinner_2024", "תוכן הברכה דינר קודם"],
  
  // הושבות גברים
  "הושבה גברים קודמת": ["men_seating_feb", "הושבה גברים קודמת"],
  "הושבה זמני גברים": ["men_temporary_seating_feb", "הושבה זמני גברים"],
  "מספר שולחן": ["men_table_number", "מספר שולחן"],
  "ליד מי תרצו לשבת": ["seat_near_main", "ליד מי תרצו לשבת"],
  
  // הושבות נשים
  "הושבה נשים קודמת": ["women_seating_feb", "הושבה נשים קודמת"],
  "הושבה זמני נשים": ["women_temporary_seating_feb", "הושבה זמני נשים"],
  "מספר שולחן נשים": ["women_table_number", "מספר שולחן נשים"],
  "השתתפות": ["women_participation_dinner_feb", "השתתפות"],
  
  // כללי
  "מגדר": ["gender", "מגדר"],
  "טלפון": ["phone", "טלפון", "mobile_phone"],
  "מספר וואטסאפ": ["whatsapp_number", "מספר וואטסאפ"],
  "מקור הפניה": ["referral_source", "מקור הפניה"],
  "כתובת": ["address", "כתובת"],
};

// קומפוננטת שורה נפרדת עם React.memo - תרונדר מחדש רק אם ה-props שלה השתנו
const GuestRow = memo(function GuestRow({
  guest,
  fields,
  guestRaw,
  tableHead,
  tableHeads,
  editingTableHeadFor,
  isViewer,
  rowKey,
  onTableHeadChange,
  onConfirmedArrivalChange,
  onDelete,
  onEditTableHead,
  onBlurTableHead,
}) {
  const tableHeadId = guestRaw?.table_head_id;
  const category = tableHead?.category || "";

  // מצב מקומי לצ'קבוקס - מאפשר עדכון מיידי של ה-UI
  const [localChecked, setLocalChecked] = React.useState(!!guest.confirmed_arrival);
  
  // מצב מקומי לראש שולחן - מאפשר עדכון מיידי של ה-UI
  const [localTableHeadId, setLocalTableHeadId] = React.useState(tableHeadId ? String(tableHeadId) : "");
  
  // סנכרון עם ה-prop כשהוא משתנה מבחוץ
  React.useEffect(() => {
    setLocalChecked(!!guest.confirmed_arrival);
  }, [guest.confirmed_arrival]);
  
  React.useEffect(() => {
    setLocalTableHeadId(tableHeadId ? String(tableHeadId) : "");
  }, [tableHeadId]);

  // handler מהיר לצ'קבוקס - קודם מעדכן את ה-UI המקומי, אח"כ שולח לשרת
  const handleCheckboxChange = React.useCallback((e) => {
    const newValue = e.target.checked;
    setLocalChecked(newValue); // עדכון מיידי של ה-UI
    onConfirmedArrivalChange(guest.id, newValue); // שליחה לשרת ברקע
  }, [guest.id, onConfirmedArrivalChange]);

  // handler מהיר לראש שולחן - קודם מעדכן את ה-UI המקומי, אח"כ שולח לשרת
  const handleTableHeadSelectChange = React.useCallback((e) => {
    const newValue = e.target.value;
    setLocalTableHeadId(newValue); // עדכון מיידי של ה-UI
    onTableHeadChange(guest.id, newValue); // שליחה לשרת ברקע
  }, [guest.id, onTableHeadChange]);

  // Build normalized index once per guest row
  const normIndex = useMemo(() => {
    const idx = {};
    for (const k of Object.keys(guest)) {
      const nk = normKey(k);
      if (nk && idx[nk] === undefined) idx[nk] = k;
    }
    return idx;
  }, [guest]);

  const getFieldValue = useCallback((fieldName) => {
    if (!fieldName) return "";

    // 1) exact match
    if (Object.prototype.hasOwnProperty.call(guest, fieldName)) {
      const val = guest[fieldName];
      if (val !== null && val !== undefined && val !== "") return val;
    }

    // 2) normalized match
    const realKey = normIndex[fieldName];
    if (realKey && Object.prototype.hasOwnProperty.call(guest, realKey)) {
      const val = guest[realKey];
      if (val !== null && val !== undefined && val !== "") return val;
    }

    // 3) fallback
    const candidates = FIELD_FALLBACK[fieldName] || [];
    for (const cand of candidates) {
      if (Object.prototype.hasOwnProperty.call(guest, cand)) {
        const val = guest[cand];
        if (val !== null && val !== undefined && val !== "") return val;
      }
    }

    // 4) case-insensitive search
    for (const key of Object.keys(guest)) {
      if (normKey(key) === fieldName) {
        const val = guest[key];
        if (val !== null && val !== undefined && val !== "") return val;
      }
    }

    return "";
  }, [guest, normIndex]);

  return (
    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
      {fields.map((field, fieldIdx) => {
        const fieldTrimmed = normKey(field);
        if (!fieldTrimmed) return null;
        
        const value = getFieldValue(fieldTrimmed);
        const cellKey = `${rowKey}-${fieldTrimmed}-${fieldIdx}`;
        
        return (
          <td
            key={cellKey}
            style={{ 
              padding: '2px 3px', 
              color: '#0f172a', 
              fontSize: 12,
              fontWeight: 500,
              borderRight: '1px solid #e2e8f0',
              width: fieldTrimmed === 'קבוצה' ? 220 : undefined,
              maxWidth: fieldTrimmed === 'תעודת זהות' ? 120 : 
                       (fieldTrimmed === 'אימייל' ? 160 : 
                       (fieldTrimmed === 'טלפון' ? 130 : 
                       (fieldTrimmed === 'שם משפחה' ? 140 : 
                       (fieldTrimmed === 'כתובת' ? 180 : 
                       (fieldTrimmed === 'מקור הפניה' ? 150 :
                       (fieldTrimmed === 'מספר וואטסאפ' ? 130 :
                       (fieldTrimmed === 'שם' ? 120 : 
                       (fieldTrimmed === 'gender' ? 85 : 
                       (fieldTrimmed === 'id' ? 60 : 'none'))))))))),
              overflow: (fieldTrimmed === 'תעודת זהות' || fieldTrimmed === 'אימייל' || fieldTrimmed === 'טלפון' || fieldTrimmed === 'שם משפחה' || fieldTrimmed === 'כתובת' || fieldTrimmed === 'מקור הפניה' || fieldTrimmed === 'מספר וואטסאפ' || fieldTrimmed === 'שם' || fieldTrimmed === 'gender' || fieldTrimmed === 'id') ? 'hidden' : 'visible',
              textOverflow: (fieldTrimmed === 'תעודת זהות' || fieldTrimmed === 'אימייל' || fieldTrimmed === 'טלפון' || fieldTrimmed === 'שם משפחה' || fieldTrimmed === 'כתובת' || fieldTrimmed === 'מקור הפניה' || fieldTrimmed === 'מספר וואטסאפ' || fieldTrimmed === 'שם' || fieldTrimmed === 'gender' || fieldTrimmed === 'id') ? 'ellipsis' : 'clip',
              whiteSpace: (fieldTrimmed === 'תעודת זהות' || fieldTrimmed === 'אימייל' || fieldTrimmed === 'טלפון' || fieldTrimmed === 'שם משפחה' || fieldTrimmed === 'כתובת' || fieldTrimmed === 'מקור הפניה' || fieldTrimmed === 'מספר וואטסאפ' || fieldTrimmed === 'שם' || fieldTrimmed === 'gender' || fieldTrimmed === 'id') ? 'nowrap' : (fieldTrimmed === 'קבוצה' ? 'normal' : 'normal'),
              wordWrap: fieldTrimmed === 'קבוצה' ? 'break-word' : undefined,
              wordBreak: fieldTrimmed === 'קבוצה' ? 'break-word' : undefined
            }}
          >
            {value === null || value === undefined ? '' : String(value)}
          </td>
        );
      })}
      <td style={{ padding: '2px 3px', maxWidth: 140, overflow: 'hidden', borderRight: '1px solid #e2e8f0' }}>
        {localTableHeadId && editingTableHeadFor !== guest.id ? (
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {category && (
              <span style={{
                background: '#f1f5f9',
                color: '#64748b',
                padding: '1px 5px',
                borderRadius: 8,
                fontSize: 8
              }}>
                {category}
              </span>
            )}
            <button
              onClick={() => onEditTableHead(guest.id)}
              style={{ background: '#e5e7eb', border: 'none', borderRadius: 3, padding: '1px 4px', cursor: 'pointer', fontSize: 8 }}
            >
              ערוך
            </button>
          </div>
        ) : (
          <select
            value={localTableHeadId}
            onChange={handleTableHeadSelectChange}
            onBlur={onBlurTableHead}
            style={{
              padding: '2px 4px',
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              maxWidth: 135,
              fontSize: 9,
              width: '100%'
            }}
          >
            <option value="">ללא ראש שולחן</option>
            {tableHeads.map(h => (
              <option key={h.id} value={String(h.id)}>
                {h.last_name} {h.phone ? `(${h.phone})` : ""}
              </option>
            ))}
          </select>
        )}
      </td>
      <td style={{ padding: '2px 3px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
        <input
          type="checkbox"
          checked={localChecked}
          onChange={handleCheckboxChange}
          style={{ width: 13, height: 13, cursor: 'pointer' }}
        />
      </td>
      <td style={{ padding: '2px 3px', textAlign: 'center' }}>
        <button
          onClick={() => onDelete(guest.id)}
          style={{
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: 3,
            padding: '2px 6px',
            fontWeight: 600,
            cursor: isViewer ? 'not-allowed' : 'pointer',
            opacity: isViewer ? 0.5 : 1,
            fontSize: 9
          }}
          disabled={isViewer}
        >
          מחק
        </button>
      </td>
    </tr>
  );
});

export default function GuestsContent() {
  const [guests, setGuests] = useState([]);
  const [filters, setFilters] = useState({});
  // שדה ברירת מחדל תואם לשמות בשאר הקוד ולשדות בפילטרים
  const [selectedFilterField, setSelectedFilterField] = useState('שם פרטי');
  const [searchValue, setSearchValue] = useState(''); // ערך החיפוש שמוצג למשתמש
  const [debouncedSearchValue, setDebouncedSearchValue] = useState(''); // ערך החיפוש המסונן (עם debounce)
  const { eventId } = useParams();
  const debounceTimerRef = useRef(null);
  const [guestsRaw, setGuestsRaw] = useState([]);
  const [tableHeads, setTableHeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTableHeadFor, setEditingTableHeadFor] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importJobId, setImportJobId] = useState(null);
  const [importJobStatus, setImportJobStatus] = useState(null); // {status, total_rows, processed_rows, success_count, error_count, error_log_path}
  const [importInfos, setImportInfos] = useState([]); // [{ filename, ids: number[], uploadedAt }]
  const [duplicateGuests, setDuplicateGuests] = useState([]); // [{ rowIndex, existingGuest, newData, allColumns, row }]
  const [guestsToUpdate, setGuestsToUpdate] = useState([]); // רשימת מוזמנים לעדכון
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingImportData, setPendingImportData] = useState(null); // { rows, customFieldsMap, allColumns, baseFieldMapping }
  const [allCustomFields, setAllCustomFields] = useState([]); // כל השדות הדינמיים מהמסד נתונים
  const [fieldsEnsured, setFieldsEnsured] = useState(false); // האם השדות כבר נוצרו
  const [tableStructure, setTableStructure] = useState([]); // מבנה גלובלי של הטבלה
  const [currentPage, setCurrentPage] = useState(1); // עמוד נוכחי בפגינציה
  const [itemsPerPage] = useState(500); // מספר פריטים לעמוד

  const storageKey = (eId) => `guestImport_${eId}`;
  const loadImportInfos = (eId) => {
    try {
      const raw = localStorage.getItem(storageKey(eId));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const saveImportInfos = (eId, infos) => { try { localStorage.setItem(storageKey(eId), JSON.stringify(infos || [])); } catch {} };
  const clearImportInfos = (eId) => { try { localStorage.removeItem(storageKey(eId)); } catch {} };

  const handleImportUpload = useCallback(async (file) => {
    if (!file) {
      alert('בחר קובץ לייבוא');
      return;
    }
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('event_id', eventId);
      formData.append('file', file);
      const res = await fetch('http://localhost:8001/imports', {
        method: 'POST',
        headers: { "Authorization": `Bearer ${localStorage.getItem('access_token')}` },
        body: formData
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(`ייבוא נכשל: ${txt}`);
        setUploading(false);
        return;
      }
      const data = await res.json();
      setImportJobId(data.id);
      setImportJobStatus(data);
      alert(`ייבוא החל - מזהה Job: ${data.id}`);
    } catch (e) {
      console.error(e);
      alert('ייבוא נכשל');
    } finally {
      setUploading(false);
    }
  }, [eventId]);

  // טען את כל הנתונים בפעם אחת
  useEffect(() => {
    let isMounted = true; // הגנה מפני עדכונים אחרי unmount
    
    const loadAllData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('access_token');
        
        // אם יש יותר מ-2000 מוזמנים, נטען בחלקים (הגדרה לפני שימוש)
        const CHUNK_SIZE = 2000;
        
        // בדוק כמה מוזמנים יש לאירוע
        let totalGuests = 0;
        let useChunkedLoading = false;
        try {
          const countResponse = await fetch(`http://localhost:8001/guests/event/${eventId}/count`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (countResponse.ok) {
            const countData = await countResponse.json();
            totalGuests = countData.count || 0;
            useChunkedLoading = totalGuests > CHUNK_SIZE;
          } else {
            // אם ה-count נכשל, נשתמש בטעינה בחלקים בכל מקרה (בטוח יותר)
            console.warn("Count endpoint failed, using chunked loading as fallback");
            useChunkedLoading = true;
          }
        } catch (err) {
          console.error("Error getting guests count:", err);
          // אם יש שגיאה, נשתמש בטעינה בחלקים בכל מקרה (בטוח יותר)
          useChunkedLoading = true;
        }
        
        let guestsWithFieldsData = [];
        
        if (useChunkedLoading) {
          if (totalGuests > 0) {
            console.log(`טוען ${totalGuests} מוזמנים בחלקים של ${CHUNK_SIZE}...`);
          } else {
            console.log(`טוען מוזמנים בחלקים של ${CHUNK_SIZE} (מספר לא ידוע)...`);
          }
          // טען בחלקים
          let offset = 0;
          let hasMoreData = true;
          while (hasMoreData && (totalGuests === 0 || offset < totalGuests)) {
            try {
              const chunkResponse = await fetch(
                `http://localhost:8001/guests/event/${eventId}/with-fields?limit=${CHUNK_SIZE}&offset=${offset}`,
                { 
                  headers: { "Authorization": `Bearer ${token}` },
                  signal: AbortSignal.timeout(60000) // timeout של 60 שניות לכל chunk
                }
              );
              if (chunkResponse.ok) {
                const chunkData = await chunkResponse.json();
                const chunkArray = Array.isArray(chunkData) ? chunkData : [];
                if (chunkArray.length === 0) {
                  // אין עוד נתונים
                  hasMoreData = false;
                } else {
                  guestsWithFieldsData = [...guestsWithFieldsData, ...chunkArray];
                  if (totalGuests > 0) {
                    console.log(`טען ${guestsWithFieldsData.length}/${totalGuests} מוזמנים...`);
                  } else {
                    console.log(`טען ${guestsWithFieldsData.length} מוזמנים...`);
                  }
                  offset += CHUNK_SIZE;
                  // אם קיבלנו פחות מ-CHUNK_SIZE, אין עוד נתונים
                  if (chunkArray.length < CHUNK_SIZE) {
                    hasMoreData = false;
                  }
                }
              } else {
                console.error(`שגיאה בטעינת chunk ${offset}-${offset + CHUNK_SIZE}:`, chunkResponse.status);
                hasMoreData = false; // עצור אם יש שגיאה
              }
            } catch (err) {
              console.error(`שגיאה בטעינת chunk ${offset}-${offset + CHUNK_SIZE}:`, err);
              hasMoreData = false; // עצור אם יש שגיאה
            }
          }
        } else {
          // טען את כל הנתונים בבת אחת
          try {
            const guestsResponse = await fetch(`http://localhost:8001/guests/event/${eventId}/with-fields`, {
              headers: { "Authorization": `Bearer ${token}` },
              signal: AbortSignal.timeout(120000) // timeout של 120 שניות
            });
            if (guestsResponse.ok) {
              guestsWithFieldsData = await guestsResponse.json();
            } else {
              console.error("שגיאה בטעינת מוזמנים:", guestsResponse.status);
              guestsWithFieldsData = [];
            }
          } catch (err) {
            console.error("שגיאה בטעינת מוזמנים:", err);
            guestsWithFieldsData = [];
          }
        }
        
        console.log("[loadAllData] After loading chunks, guestsWithFieldsData length:", guestsWithFieldsData.length);
        console.log("[loadAllData] First few guests:", guestsWithFieldsData.slice(0, 3));
        // דיבוג: בדוק את המפתחות של האובייקט הראשון
        if (guestsWithFieldsData.length > 0) {
          console.log("[loadAllData] First guest keys:", Object.keys(guestsWithFieldsData[0]));
          console.log("[loadAllData] First guest sample data:", {
            first_name: guestsWithFieldsData[0].first_name,
            last_name: guestsWithFieldsData[0].last_name,
            phone: guestsWithFieldsData[0].phone,
            email: guestsWithFieldsData[0].email,
            city: guestsWithFieldsData[0].city,
            street: guestsWithFieldsData[0].street,
            groups: guestsWithFieldsData[0].groups,
            identifier: guestsWithFieldsData[0].identifier,
          });
        }
        
        // טען את הנתונים במקביל - בלי לחכות ל-ensure-all-fields (זה יכול להיות איטי)
        // ensure-all-fields ירוץ ברקע ולא יעכב את הטעינה
        const loadPromises = [
          fetch(`http://localhost:8001/tables/table-heads/event/${eventId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          Promise.resolve(guestsWithFieldsData), // כבר טענו את זה
          fetch(`http://localhost:8001/guests/event/${eventId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()),
          fetch(`http://localhost:8001/guests/custom-field/${eventId}`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()).catch(() => []),
          fetch(`http://localhost:8001/table-structure/`, {
            headers: { "Authorization": `Bearer ${token}` }
          }).then(res => res.json()).catch(() => [])
        ];

        // וודא שכל השדות קיימים במסד הנתונים - רץ במקביל (לא חוסם)
        // רק פעם אחת - לא תלוי ב-fieldsEnsured כדי למנוע לולאה אינסופית
        fetch(`http://localhost:8001/guests/events/${eventId}/ensure-all-fields`, {
          method: 'POST',
          headers: { "Authorization": `Bearer ${token}` }
        })
        .then(res => {
          if (res.ok && isMounted) {
            setFieldsEnsured(true);
          }
        })
        .catch(err => {
          console.error("Error ensuring all fields:", err);
        });
        
        // טען את כל הנתונים במקביל
        const [tableHeadsData, , guestsRawData, customFieldsData, tableStructureData] = await Promise.all(loadPromises);

        // עדכן state רק אם הקומפוננטה עדיין mounted
        if (isMounted) {
          console.log("[loadAllData] Setting state:", {
            guestsWithFieldsDataLength: Array.isArray(guestsWithFieldsData) ? guestsWithFieldsData.length : 'not array',
            guestsWithFieldsDataType: typeof guestsWithFieldsData,
            guestsRawDataLength: Array.isArray(guestsRawData) ? guestsRawData.length : 'not array',
            customFieldsDataLength: Array.isArray(customFieldsData) ? customFieldsData.length : 'not array',
            tableStructureDataLength: Array.isArray(tableStructureData) ? tableStructureData.length : 'not array'
          });
          setTableHeads(Array.isArray(tableHeadsData) ? tableHeadsData : []);
          setGuests(Array.isArray(guestsWithFieldsData) ? guestsWithFieldsData : []);
          setGuestsRaw(Array.isArray(guestsRawData) ? guestsRawData : []);
          setAllCustomFields(Array.isArray(customFieldsData) ? customFieldsData : []);
          setTableStructure(Array.isArray(tableStructureData) ? tableStructureData : []);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadAllData();
    setImportInfos(loadImportInfos(eventId));
    
    return () => {
      isMounted = false; // נקה את ה-flag כשה-component unmount
    };
  }, [eventId]); // הסרנו את fieldsEnsured מה-dependencies כדי למנוע לולאה אינסופית

  // פולינג לסטטוס ייבוא (job-based)
  useEffect(() => {
    if (!importJobId) return;
    
    // בדיקה ראשונית - אם ה-job כבר נכשל, אל נתחיל polling
    if (importJobStatus?.status === "failed") {
      console.log(`[Import Job] Job ${importJobId} already failed, skipping polling`);
      return;
    }
    
    let active = true;
    let timeoutId = null;
    let pollCount = 0;
    const MAX_POLLS = 1200; // מקסימום 50 דקות (1200 * 2.5 שניות)

    const poll = async () => {
      if (!active) return;
      pollCount++;
      
      // הגבל את מספר ה-polls למניעת polling אינסופי
      if (pollCount > MAX_POLLS) {
        console.warn(`Import job ${importJobId} exceeded max polls, stopping`);
        setImportJobStatus(prev => prev ? { ...prev, status: "timeout" } : null);
        return;
      }

      try {
        const res = await fetch(`http://localhost:8001/imports/${importJobId}`, {
          headers: { "Authorization": `Bearer ${localStorage.getItem('access_token')}` }
        });
        if (!res.ok) {
          console.error(`Failed to fetch import job status: ${res.status}`);
          return;
        }
        const data = await res.json();
        if (!active) return;
        setImportJobStatus(data);

        const status = (data.status || "").toLowerCase();
        if (["success", "failed", "partial"].includes(status)) {
          // אם ה-job הסתיים, עצור את ה-polling
          console.log(`[Import Job] Job ${importJobId} finished with status: ${status}`);
          if (status === "success" || status === "partial") {
            // רענון אוטומטי של הנתונים אחרי ייבוא מוצלח
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          } else if (status === "failed") {
            // אם נכשל, נעצור את ה-polling ולא ננסה שוב
            console.warn(`[Import Job] Job ${importJobId} failed, stopping polling`);
          }
          return; // עצור את ה-polling
        }
        // המשך polling רק אם ה-job עדיין רץ
        if (active) {
          timeoutId = setTimeout(poll, 2500);
        }
      } catch (e) {
        console.error("poll import job failed", e);
        if (active) {
          timeoutId = setTimeout(poll, 5000); // נסה שוב אחרי 5 שניות במקרה של שגיאה
        }
      }
    };

    poll();
    return () => { 
      active = false; 
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      console.log(`[Import Job] Cleanup polling for job ${importJobId}`);
    };
  }, [importJobId, importJobStatus?.status]); // הוספנו את importJobStatus?.status כדי לעצור אם ה-status משתנה

  // Handler עבור שינוי החיפוש - עדכון מיידי של searchValue
  const handleSearchChange = useCallback((e) => {
    const newValue = e.target.value;
    setSearchValue(newValue); // עדכון מיידי - זה מה שהמשתמש רואה
    
    // Debounce עבור הסינון - עדכן את debouncedSearchValue רק אחרי 300ms
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    if (!newValue || newValue.trim() === '') {
      setDebouncedSearchValue('');
      return;
    }
    
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchValue(newValue.trim());
    }, 300);
  }, []);

  const handleTableHeadChange = useCallback(async (guestId, tableHeadId) => {
    try {
      const token = localStorage.getItem('access_token');
      const guest = guests.find(g => g.id === guestId);
      if (!guest) return;

      const newTableHeadId = tableHeadId === "" ? null : Number(tableHeadId);

      // עדכון מיידי בממשק המשתמש - עם startTransition כדי לא לחסום את ה-UI
      startTransition(() => {
        setGuestsRaw(prevGuestsRaw => 
          prevGuestsRaw.map(g => 
            g.id === guestId 
              ? { ...g, table_head_id: newTableHeadId }
              : g
          )
        );
        setGuests(prevGuests => 
          prevGuests.map(g => 
            g.id === guestId 
              ? { ...g, table_head_id: newTableHeadId }
              : g
          )
        );
      });

      // עדכון בשרת - ללא רענון מלא של כל הרשימה
      const response = await fetch(`http://localhost:8001/guests/${guestId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: guest["שם פרטי"] || "",
          last_name: guest["שם משפחה"] || "",
          id_number: guest["תעודת זהות"] || "",
          address: guest["כתובת"] || "",
          phone: guest["טלפון"] || "",
          email: guest["אימייל"] || "",
          referral_source: guest["מקור הפניה"] || "",
          whatsapp_number: guest["מספר וואטסאפ"] || "",
          gender: guest["gender"] || "male",
          table_head_id: newTableHeadId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update table head: ${response.statusText}`);
      }

      setEditingTableHeadFor(null);
    } catch (error) {
      console.error("Error updating table head:", error);
      // אם יש שגיאה, נחזיר את המצב הקודם
      const guest = guests.find(g => g.id === guestId);
      if (guest) {
        startTransition(() => {
          setGuestsRaw(prevGuestsRaw => 
            prevGuestsRaw.map(g => 
              g.id === guestId ? { ...g, table_head_id: guest.table_head_id } : g
            )
          );
          setGuests(prevGuests => 
            prevGuests.map(g => 
              g.id === guestId ? { ...g, table_head_id: guest.table_head_id } : g
            )
          );
        });
      }
    }
  }, [eventId, guests]);

  const handleConfirmedArrivalChange = useCallback(async (guestId, confirmed) => {
    try {
      const token = localStorage.getItem('access_token');
      const guest = guests.find(g => g.id === guestId);
      if (!guest) return;

      // עדכון מיידי בממשק המשתמש - עם startTransition כדי לא לחסום את ה-UI
      startTransition(() => {
        setGuests(prevGuests => 
          prevGuests.map(g => 
            g.id === guestId 
              ? { ...g, confirmed_arrival: confirmed }
              : g
          )
        );
        setGuestsRaw(prevGuestsRaw => 
          prevGuestsRaw.map(g => 
            g.id === guestId 
              ? { ...g, confirmed_arrival: confirmed }
              : g
          )
        );
      });

      // עדכון בשרת - ללא רענון מלא של כל הרשימה
      const response = await fetch(`http://localhost:8001/guests/${guestId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: guest["שם פרטי"] || "",
          last_name: guest["שם משפחה"] || "",
          id_number: guest["תעודת זהות"] || "",
          address: guest["כתובת"] || "",
          phone: guest["טלפון"] || "",
          email: guest["אימייל"] || "",
          referral_source: guest["מקור הפניה"] || "",
          whatsapp_number: guest["מספר וואטסאפ"] || "",
          gender: guest["gender"] || "male",
          table_head_id: guest.table_head_id,
          confirmed_arrival: confirmed
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update confirmed arrival: ${response.statusText}`);
      }

      console.log(`מוזמן ${guest["שם פרטי"]} ${guest["שם משפחה"]} ${confirmed ? 'אושר' : 'בוטל'} הגעה`);
    } catch (error) {
      console.error("Error updating confirmed arrival:", error);
      // אם יש שגיאה, נחזיר את המצב הקודם
      startTransition(() => {
        setGuests(prevGuests => 
          prevGuests.map(g => 
            g.id === guestId 
              ? { ...g, confirmed_arrival: !confirmed }
              : g
          )
        );
        setGuestsRaw(prevGuestsRaw => 
          prevGuestsRaw.map(g => 
            g.id === guestId 
              ? { ...g, confirmed_arrival: !confirmed }
              : g
          )
        );
      });
    }
  }, [eventId, guests]);

  const BASE_FIELDS = [
    "id",
    // פרטים אישיים
    "תואר לפני",
    "תואר אחרי",
    "שם פרטי",
    "שם אמצעי",
    "שם משפחה",
    "שם אישה",
    "תואר בן זוג",
    "תואר אחרי בן זוג",
    "גיל",
    "תאריך לידה",
    "ת.ז./ח.פ.",
    "שפה",
    // פרטי קשר
    "מספר נייד",
    "טלפון בית",
    "טלפון נוסף",
    "טלפון נוסף 2",
    "Email",
    "2 Email",
    "טלפון אשה",
    // מזהים
    "מספר חשבון",
    "מספר אישי מניג'ר",
    "CardID",
    // שיוך וניהול
    "קבוצה",
    "קבוצה מייל",
    "קישור למשתמש",
    "מזהה שגריר",
    "שגריר",
    "שיוך לטלפנית",
    "בית כנסת",
    // טלפניות ושיחות
    "סטטוס זכאות ללידים",
    "ביקש לחזור בתאריך",
    "שיחה אחרונה עם טלפנית",
    "סטטוס שיחה אחרונה",
    "הערות טלפניות",
    "תאור סטטוס",
    // כתובת ראשית
    "רחוב",
    "מספר בניין",
    "מספר דירה",
    "עיר",
    "שכונה",
    "מיקוד",
    "מדינה",
    "ארץ",
    "כתובת למשלוח דואר",
    "שם לקבלה",
    // בנקים ותשלומים
    "שם בנק",
    "סניף",
    "מספר כרטיס אשראי",
    // תרומות
    "האם הוק פעיל",
    "סכום הוק חודשי בש\"ח",
    "סכום תשלום אחרון",
    "סכום תרומות ותשלומים בשנה האחרונה",
    "סכום תרומות ותשלומים סהכ",
    "התחייבות לתרומה",
    "יכולת תרומה",
    // היסטוריית תרומות
    "תרומות בשנה האחרונה",
    // אירועים ודינרים
    "דינרים משתתפים",
    "סטטוס חסות/ברכה",
    "תוכן הברכה דינר קודם",
    // הושבות גברים
    "הושבה גברים קודמת",
    "הושבה זמני גברים",
    "מספר שולחן",
    // הושבות נשים
    "הושבה נשים קודמת",
    "הושבה זמני נשים",
    "מספר שולחן נשים",
    "השתתפות",
    "ליד מי תרצו לשבת",
    // כללי
    "הערות",
    "מאפיינים",
  ];

  const FIELD_LABELS = {
    id: "ID",
    "שם פרטי": "שם פרטי",
    "שם משפחה": "שם משפחה",
    "טלפון": "טלפון",
    "אימייל": "אימייל",
    "תעודת זהות": "תעודת זהות",
    "כתובת": "כתובת",
    "מקור הפניה": "מקור הפניה",
    "מספר וואטסאפ": "מספר וואטסאפ",
    gender: "מגדר",
    confirmed_arrival: "אישור הגעה",
  };

  // שדות הטבלה - משתמשים במבנה גלובלי (tableStructure), ואם אין אז נופלים ללוגיקה הישנה
  const { fields, filterFields } = useMemo(() => {
    const baseFieldsList = BASE_FIELDS.filter((f) => f !== "id");

    // אם יש מבנה גלובלי, נשתמש בו - אבל נשתמש ב-BASE_FIELDS כבסיס לסדר
    if (Array.isArray(tableStructure) && tableStructure.length > 0) {
      const structureFields = tableStructure
        .map((item) => (item?.column_name || "").trim())
        .filter((name) => !!name)
        .map((name) => name.replace(/\s*\*$/, ""));

      console.log("[GuestsContent] Using tableStructure:", {
        totalStructureItems: tableStructure.length,
        structureFieldsCount: structureFields.length,
        structureFields: structureFields.slice(0, 20) // רק 20 ראשונים לדיבוג
      });

      // נשתמש ב-BASE_FIELDS כבסיס לסדר, ונשמור על הסדר המדויק
      // נציג רק את השדות שקיימים ב-BASE_FIELDS (לא נוסיף שדות נוספים)
      // נסיר כפילויות - נשמור רק את ההופעה הראשונה
      const seenFields = new Set();
      const orderedFields = baseFieldsList.filter(f => {
        if (seenFields.has(f)) {
          return false; // כפילות - נדלג
        }
        seenFields.add(f);
        return true;
      });

      console.log("[GuestsContent] Final orderedFields count:", orderedFields.length);

      const filterFieldsList = [...orderedFields, "confirmed_arrival"];
      return { fields: orderedFields, filterFields: filterFieldsList };
    }

    console.log("[GuestsContent] No tableStructure, using BASE_FIELDS only. tableStructure:", tableStructure);

    // נשתמש רק ב-BASE_FIELDS - לא נוסיף שדות נוספים
    // נסיר כפילויות - נשמור רק את ההופעה הראשונה
    const seenFields = new Set();
    const finalFields = baseFieldsList.filter(f => {
      if (!f || typeof f !== 'string' || f.trim() === '') {
        return false;
      }
      if (seenFields.has(f)) {
        return false; // כפילות - נדלג
      }
      seenFields.add(f);
      return true;
    });
    
    const filterFieldsList = [...finalFields, "confirmed_arrival"];
    return { fields: finalFields, filterFields: filterFieldsList };
  }, [allCustomFields, guests, tableStructure]);

  // הסרת console.log מיותרים - רק בדיבוג אם צריך
  // אם צריך דיבוג, אפשר להסיר את ההערה:
  /*
  useEffect(() => {
  if (guests.length > 0) {
      console.log("Fields calculated:", fields.length);
    }
  }, [fields, guests.length]);
  */

  // יצירת Maps לאופטימיזציה - רק פעם אחת
  const guestsRawMap = useMemo(() => {
    const map = new Map();
    guestsRaw.forEach(gr => map.set(gr.id, gr));
    return map;
  }, [guestsRaw]);

  const tableHeadsMap = useMemo(() => {
    const map = new Map();
    tableHeads.forEach(th => map.set(th.id, th));
    return map;
  }, [tableHeads]);

  // יצירת field key map לכל מוזמן - אופטימיזציה
  const guestFieldKeysMap = useMemo(() => {
    if (guests.length === 0) return new Map();
    const map = new Map();

    // מיפוי מלא בין שמות בעברית למפתחות באנגלית - נבנה מכל ה-baseFieldMapping
    // זה מבטיח שכל השדות יוצגו גם אם ה-key באנגלית
    const baseFieldMappingForMap = {
      'first_name': ['first_name', 'שם', 'שם פרטי'],
      'last_name': ['last_name', 'שם משפחה'],
      'id_number': ['id_number', 'תעודת זהות', 'מספר זהות', 'ת.ז./ח.פ.'],
      'phone': ['phone', 'טלפון', 'פלאפון', 'מספר נייד', 'טלפון בית', 'טלפון נוסף'],
      'email': ['email', 'מייל', 'אימייל'],
      'address': ['address', 'כתובת', 'כתובת מגורים', 'כתובת למשלוח דואר'],
      'referral_source': ['referral_source', 'מקור הפניה', 'מקור', 'איך שמעת', 'מקור הגעה'],
      'whatsapp_number': ['whatsapp_number', 'מספר וואטסאפ', 'וואטסאפ', 'whatsapp'],
      'gender': ['gender', 'מגדר', 'מין'],
      'home_phone': ['home_phone', 'טלפון בית'],
      'alt_phone_1': ['alt_phone_1', 'טלפון נוסף'],
      'city': ['city', 'עיר'],
      'postal_code': ['postal_code', 'מיקוד'],
      'street': ['street', 'רחוב'],
      'apartment_number': ['apartment_number', 'מספר דירה'],
      'building_number': ['building_number', 'מספר בניין'],
      'notes': ['notes', 'הערות'],
      'requested_return_date': ['requested_return_date', 'ביקש לחזור בתאריך', 'ביקש לחזור'],
      'recipient_name': ['recipient_name', 'שם לקבלה'],
      'display_type': ['display_type', 'סוג תצוגה'],
      'last_telephonist_call': ['last_telephonist_call', 'שיחה אחרונה עם טלפנית', 'שיחה אחרונה'],
      'telephonist_assignment': ['telephonist_assignment', 'שיוך לטלפנית'],
      'ambassador_id': ['ambassador_id', 'מזהה שגריר'],
      'groups': ['groups', 'קבוצות'],
      'identifier': ['identifier', 'מזהה'],
      'import_identifier': ['import_identifier', 'מזהה יבוא'],
      'mailing_address': ['mailing_address', 'כתובת למשלוח דואר', 'כתובת למש'],
      'mobile_phone': ['mobile_phone', 'מספר נייד'],
      'middle_name': ['middle_name', 'שם אמצעי'],
      'title_before': ['title_before', 'תואר לפני'],
      'title_after': ['title_after', 'תואר אחרי'],
      'nickname': ['nickname', 'כינוי'],
      'spouse_name': ['spouse_name', 'שם בן/בת הזוג', 'שם בת הזוג'],
      'wife_name': ['wife_name', 'שם האישה'],
      'age': ['age', 'גיל'],
      'birth_date': ['birth_date', 'תאריך לידה'],
      'language': ['language', 'שפה'],
      'alt_phone_2': ['alt_phone_2', 'טלפון נוסף 2'],
      'email_2': ['email_2', 'Email 2'],
      'alt_email': ['alt_email', 'מייל נוסף'],
      'work_email': ['work_email', 'מייל עבודה'],
      'wife_phone': ['wife_phone', 'טלפון אשה'],
      'neighborhood': ['neighborhood', 'שכונה'],
      'country': ['country', 'מדינה'],
      'state': ['state', 'ארץ'],
      'eligibility_status_for_leads': ['eligibility_status_for_leads', 'סטטוס זכאות ללידים', 'סטטוס'],
      'last_call_status': ['last_call_status', 'סטטוס שיחה אחרונה'],
      'telephonist_notes': ['telephonist_notes', 'הערות טלפניות'],
      'status_description': ['status_description', 'תאור סטטוס'],
      'ambassador': ['ambassador', 'שגריר'],
      'marked_as_ambassador': ['marked_as_ambassador', 'מסומן כשגריר'],
      'ambassador_status': ['ambassador_status', 'סטטוס לשגריר'],
      'telephonist_update': ['telephonist_update', 'עדכון טלפנית'],
      'category': ['category', 'קטגוריה'],
      'women_category': ['women_category', 'קטגוריה נשים'],
      'invitation_classification': ['invitation_classification', 'סיווג להזמנה'],
      'arrival_source': ['arrival_source', 'מקור הגעה'],
      'synagogue': ['synagogue', 'בית כנסת'],
      'treatment_status': ['treatment_status', 'סטאטוס טיפול'],
    };
    
    // בניית המיפוי ההפוך: עברית -> אנגלית
    const hebrewToEnglishMap = {};
    Object.entries(baseFieldMappingForMap).forEach(([englishKey, hebrewVariants]) => {
      hebrewVariants.forEach(hebrewVariant => {
        if (typeof hebrewVariant === 'string' && hebrewVariant.trim()) {
          // אם זה לא המפתח באנגלית עצמו, הוסף למיפוי
          if (hebrewVariant !== englishKey) {
            hebrewToEnglishMap[hebrewVariant] = englishKey;
          }
        }
      });
    });
    
    // הוסף גם את המפתחות באנגלית לעצמם (למקרה שהשדה נקרא באנגלית)
    Object.keys(baseFieldMappingForMap).forEach(englishKey => {
      if (!hebrewToEnglishMap[englishKey]) {
        hebrewToEnglishMap[englishKey] = englishKey;
      }
    });

    guests.forEach(g => {
      const fieldMap = new Map();

      // הוסף את כל המפתחות שקיימים על האובייקט (אנגלית/עברית כפי שהגיעו)
      Object.keys(g).forEach(key => {
        const trimmed = key.trim();
        if (!fieldMap.has(trimmed)) {
          fieldMap.set(trimmed, key);
        }
      });

      // הוסף מיפוי עברית -> אנגלית - תמיד ננסה למפות, גם אם המפתח לא קיים
      // זה מבטיחשהשדה בעברית (כמו "עיר"), נחפש את המפתח באנגלית (כמו "city")
      Object.entries(hebrewToEnglishMap).forEach(([hebrew, english]) => {
        // אם המפתח באנגלית קיים באובייקט, נשתמש בו
        if (g.hasOwnProperty(english) && !fieldMap.has(hebrew)) {
          fieldMap.set(hebrew, english);
        }
        // גם אם המפתח באנגלית לא קיים, נשמור את המיפוי (למקרה שהמפתח יופיע מאוחר יותר)
        // אבל רק אם אין כבר מיפוי אחר
        if (!fieldMap.has(hebrew)) {
          fieldMap.set(hebrew, english);
        }
        // וגם הפוך: אם קיים מפתח בעברית, שמור אותו כדי לא לאבד את הערך
        if (g.hasOwnProperty(hebrew) && !fieldMap.has(hebrew)) {
          fieldMap.set(hebrew, hebrew);
        }
      });

      map.set(g.id, fieldMap);
    });
    return map;
  }, [guests]);

  // סינון לפי השדה שנבחר - עם useMemo לביצועים טובים יותר
  const filteredGuests = useMemo(() => {
    console.log("[filteredGuests] guests length:", guests.length);
    if (!debouncedSearchValue) {
      return guests; // אם אין ערך חיפוש, הצג הכל
    }

    const field = selectedFilterField;
    
    // טיפול מיוחד בשדה confirmed_arrival
    if (field === "confirmed_arrival") {
      if (debouncedSearchValue === "confirmed" || debouncedSearchValue === "אישרו") {
        return guests.filter(g => !!g.confirmed_arrival);
      }
      if (debouncedSearchValue === "unconfirmed" || debouncedSearchValue === "לא אישרו") {
        return guests.filter(g => !g.confirmed_arrival);
      }
      return guests;
    }

    // חיפוש רגיל - מחפש אם הערך מכיל את הטקסט (case-insensitive)
    const searchLower = debouncedSearchValue.toLowerCase();
    const fieldTrimmed = selectedFilterField.trim();
    
    return guests.filter((g) => {
      // נחפש את השדה במוזמן - ננסה כמה אפשרויות
      let fieldValue = null;
      
      // נסה למצוא את השדה במוזמן
      if (g[selectedFilterField] !== undefined) {
        fieldValue = g[selectedFilterField];
      } else {
        // נחפש עם trim
        const foundKey = Object.keys(g).find(key => key.trim() === fieldTrimmed);
        if (foundKey) {
          fieldValue = g[foundKey];
        } else {
          // נשתמש ב-field key map אם יש
          const fieldKeyMap = guestFieldKeysMap.get(g.id);
          if (fieldKeyMap) {
            const foundKey = fieldKeyMap.get(fieldTrimmed);
            if (foundKey) {
              fieldValue = g[foundKey];
            }
          }
        }
      }
      
      // אם לא מצאנו את השדה, נחזיר false (לא להציג את המוזמן)
      if (fieldValue === null || fieldValue === undefined) {
        return false;
      }
      
      // חיפוש case-insensitive
      const fieldValueStr = String(fieldValue).toLowerCase();
      return fieldValueStr.includes(searchLower);
    });
  }, [guests, selectedFilterField, debouncedSearchValue, guestFieldKeysMap]);

  // דחיית רשימת הסינון כדי להחליק את ההקלדה
  const deferredFilteredGuests = useDeferredValue(filteredGuests);

  // איפוס עמוד כאשר הסינון משתנה
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredGuests.length, debouncedSearchValue, selectedFilterField]);

  // גלילה למעלה כאשר משנים עמוד
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  // חישוב הנתונים לפגינציה
  const paginatedGuests = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return deferredFilteredGuests.slice(startIndex, endIndex);
  }, [deferredFilteredGuests, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(deferredFilteredGuests.length / itemsPerPage);

  const [exportPreset, setExportPreset] = useState('all');

  const getGuestsForExport = () => {
    const base = filteredGuests;
    switch (exportPreset) {
      case 'confirmed':
        return base.filter(g => !!g.confirmed_arrival);
      case 'male':
        return base.filter(g => String(g.gender || '').toLowerCase() === 'male');
      case 'female':
        return base.filter(g => String(g.gender || '').toLowerCase() === 'female');
      case 'female_confirmed':
        return base.filter(g => String(g.gender || '').toLowerCase() === 'female' && !!g.confirmed_arrival);
      case 'male_confirmed':
        return base.filter(g => String(g.gender || '').toLowerCase() === 'male' && !!g.confirmed_arrival);
      case 'all':
      default:
        return base;
    }
  };

  const exportToExcel = () => {
    const data = getGuestsForExport();
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Guests");
    XLSX.writeFile(wb, "guests.xlsx");
  };

  // העלאת אקסל וייבוא מוזמנים
  const normalizeGender = (val) => {
    const s = String(val || '').trim().toLowerCase();
    if (["male", "m", "זכר", "גבר", "גברים"].includes(s)) return "male";
    if (["female", "f", "נקבה", "אשה", "נשים"].includes(s)) return "female";
    return "male"; // ברירת מחדל
  };

  const pickField = (row, keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null) return String(row[k]).trim();
    }
    return "";
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!Array.isArray(rows) || rows.length === 0) {
        alert('הקובץ ריק או לא נקרא');
        return;
      }
      const token = localStorage.getItem('access_token');
      const createdIds = [];
      
      // קבלת כל שמות העמודות מהשורה הראשונה
      const allColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
      
      // מיפוי שדות בסיסיים - כולל את כל השדות החדשים
      const baseFieldMapping = {
        'first_name': ['first_name', 'שם', 'שם פרטי'],
        'last_name': ['last_name', 'שם משפחה'],
        'id_number': ['id_number', 'תעודת זהות', 'מספר זהות', 'ת.ז./ח.פ.'],
        'phone': ['phone', 'טלפון', 'פלאפון', 'מספר נייד', 'טלפון בית', 'טלפון נוסף'],
        'email': ['email', 'מייל', 'אימייל'],
        'address': ['address', 'כתובת', 'כתובת מגורים', 'כתובת למשלוח דואר'],
        'referral_source': ['referral_source', 'מקור הפניה', 'מקור', 'איך שמעת', 'מקור הגעה'],
        'whatsapp_number': ['whatsapp_number', 'מספר וואטסאפ', 'וואטסאפ', 'whatsapp'],
        'gender': ['gender', 'מגדר', 'מין'],
        'table_head': ['table_head', 'ראש שולחן', 'קטגוריה'],
        
        // פרטים אישיים
        'middle_name': ['middle_name', 'שם אמצעי'],
        'first_name_split': ['first_name_split', 'שם פרטי מחולק'],
        'last_name_split': ['last_name_split', 'שם משפחה מחולק'],
        'first_name_without_wife': ['first_name_without_wife', 'שם פרטי ללא אשה'],
        'title_before': ['title_before', 'תואר לפני'],
        'title_after': ['title_after', 'תואר אחרי'],
        'nickname': ['nickname', 'כינוי'],
        'spouse_name': ['spouse_name', 'שם בן/בת הזוג', 'שם בת הזוג'],
        'wife_name': ['wife_name', 'שם האישה'],
        'wife_name_dinner': ['wife_name_dinner', 'שם אישה לדינר פד'],
        'age': ['age', 'גיל'],
        'birth_date': ['birth_date', 'תאריך לידה'],
        'student_code': ['student_code', 'קוד תלמיד נ_י'],
        'language': ['language', 'שפה'],
        
        // פרטי קשר
        'mobile_phone': ['mobile_phone', 'מספר נייד'],
        'home_phone': ['home_phone', 'טלפון בית'],
        'alt_phone_1': ['alt_phone_1', 'טלפון נוסף'],
        'alt_phone_2': ['alt_phone_2', 'טלפון נוסף 2'],
        'email_2': ['email_2', 'Email 2'],
        'alt_email': ['alt_email', 'מייל נוסף'],
        'work_email': ['work_email', 'מייל עבודה'],
        'wife_phone': ['wife_phone', 'טלפון אשה'],
        
        // מזהים
        'identifier': ['identifier', 'מזהה'],
        'import_identifier': ['import_identifier', 'מזהה יבוא'],
        'manager_personal_number': ['manager_personal_number', 'מספר אישי מניג\'ר'],
        'card_id': ['card_id', 'CardID'],
        'raf': ['raf', 'RAF'],
        'previous_system_id': ['previous_system_id', 'ID ממערכת קודמת'],
        
        // שיוך וניהול
        'groups': ['groups', 'קבוצות'],
        'email_group': ['email_group', 'קבוצה מייל'],
        'user_link': ['user_link', 'קישור למשתמש'],
        'ambassador_id': ['ambassador_id', 'מזהה שגריר'],
        'ambassador': ['ambassador', 'שגריר'],
        'marked_as_ambassador': ['marked_as_ambassador', 'מסומן כשגריר'],
        'ambassador_status': ['ambassador_status', 'סטטוס לשגריר'],
        'display_type': ['display_type', 'סוג תצוגה'],
        'telephonist_assignment': ['telephonist_assignment', 'שיוך לטלפנית'],
        'telephonist_update': ['telephonist_update', 'עדכון טלפנית'],
        'category': ['category', 'קטגוריה'],
        'women_category': ['women_category', 'קטגוריה נשים'],
        'invitation_classification': ['invitation_classification', 'סיווג להזמנה'],
        'arrival_source': ['arrival_source', 'מקור הגעה'],
        'synagogue': ['synagogue', 'בית כנסת'],
        'treatment_status': ['treatment_status', 'סטאטוס טיפול'],
        
        // טלפניות ושיחות
        'eligibility_status_for_leads': ['eligibility_status_for_leads', 'סטטוס זכאות ללידים'],
        'requested_return_date': ['requested_return_date', 'ביקש לחזור בתאריך'],
        'last_telephonist_call': ['last_telephonist_call', 'שיחה אחרונה עם טלפנית'],
        'last_call_status': ['last_call_status', 'סטטוס שיחה אחרונה'],
        'notes': ['notes', 'הערות'],
        'telephonist_notes': ['telephonist_notes', 'הערות טלפניות'],
        'status_description': ['status_description', 'תאור סטטוס'],
        
        // כתובת ראשית
        'street': ['street', 'רחוב'],
        'building_number': ['building_number', 'מספר בניין'],
        'apartment_number': ['apartment_number', 'מספר דירה'],
        'city': ['city', 'עיר'],
        'neighborhood': ['neighborhood', 'שכונה'],
        'postal_code': ['postal_code', 'מיקוד'],
        'country': ['country', 'מדינה'],
        'state': ['state', 'ארץ'],
        'mailing_address': ['mailing_address', 'כתובת למשלוח דואר'],
        'recipient_name': ['recipient_name', 'שם לקבלה'],
        
        // בנקים ותשלומים
        'bank': ['bank', 'בנק'],
        'branch': ['branch', 'סניף'],
        'account_number': ['account_number', 'מספר חשבון'],
        'bank_account_name': ['bank_account_name', 'שם בבנק'],
        'credit_card_number': ['credit_card_number', 'מספר כרטיס אשראי'],
        
        // תרומות
        'is_hok_active': ['is_hok_active', 'האם הוק פעיל'],
        'active_hok': ['active_hok', 'הוק פעיל'],
        'hok_amount_05_2024': ['hok_amount_05_2024', 'כמות הוק 05/2024'],
        'monthly_hok_amount': ['monthly_hok_amount', 'סכום הוק חודשי ₪'],
        'donation': ['donation', 'תרומה'],
        'monthly_hok_amount_nis': ['monthly_hok_amount_nis', 'סכום הוק חודשי ₪ (נוסף)'],
        'payment': ['payment', 'תשלום'],
        'hok_amount_05_24': ['hok_amount_05_24', 'סכום הוק חודשי 05-24'],
        'receipt_sending_concentration': ['receipt_sending_concentration', 'ריכוז שליחת קבלות'],
        'last_payment_date': ['last_payment_date', 'תאריך תשלום אחרון'],
        'last_payment_amount': ['last_payment_amount', 'סכום תשלום אחרון'],
        'last_transaction_date': ['last_transaction_date', 'תאריך עסקה אחרונה'],
        'last_transaction_amount': ['last_transaction_amount', 'סכום עסקה אחרונה'],
        'donations_payments_last_year': ['donations_payments_last_year', 'סכום תרומות ותשלומים בשנה האחרונה'],
        'total_donations_payments': ['total_donations_payments', 'סכום תרומות ותשלומים סהכ'],
        'max_one_time_donation': ['max_one_time_donation', 'הגבוה לתרומה חד פעמית'],
        'max_recurring_donation': ['max_recurring_donation', 'הגבוה לתרומה בהוראת קבע'],
        'donation_commitment': ['donation_commitment', 'התחייבות לתרומה'],
        'donation_ability': ['donation_ability', 'יכולת תרומה'],
        
        // היסטוריית תרומות
        'donations_2019': ['donations_2019', 'תרומות 2019'],
        'donations_2020': ['donations_2020', 'תרומות 2020'],
        'total_donations_2021': ['total_donations_2021', 'סהכ תרומות 2021'],
        'total_donations_2022': ['total_donations_2022', 'סהכ תרומות 2022'],
        'total_donations_2023': ['total_donations_2023', 'סהכ תרומות 2023'],
        'total_donations_2024': ['total_donations_2024', 'סהכ תרומות 2024'],
        'total_donations_2019_2023': ['total_donations_2019_2023', 'סהכ תרומות 2019-2023'],
        'donated_this_year_2024': ['donated_this_year_2024', 'תרמו השנה 2024'],
        'total_donations': ['total_donations', 'סהכ תרומות'],
        
        // אירועים ודינרים
        'dinners_participated': ['dinners_participated', 'דינרים משתתפים'],
        'assigned_to_dinners': ['assigned_to_dinners', 'משוייך לדינרים'],
        'dinner_2024_invited_by_amount': ['dinner_2024_invited_by_amount', 'דינר 2024 מוזמנים לפי סכום'],
        'dinner_2022_invited': ['dinner_2022_invited', 'דינר 2022 מוזמנים'],
        'seating_dinner_feb': ['seating_dinner_feb', 'הושבה דינר פב'],
        'seating_dinner_2019': ['seating_dinner_2019', 'הושבה דינר 2019'],
        'participation_dinner_feb': ['participation_dinner_feb', 'השתתפות דינר פב'],
        'sponsorship_blessing_status': ['sponsorship_blessing_status', 'סטטוס חסות/ברכה'],
        'dinner_contact_person_name': ['dinner_contact_person_name', 'שם רכז איש קשר דינר'],
        'dinner_contact_person_full_name': ['dinner_contact_person_full_name', 'שם מלא איש קשר דינר'],
        'blessing_content_dinner_2024': ['blessing_content_dinner_2024', 'תוכן הברכה דינר תשפד'],
        'blessing_signer_2024': ['blessing_signer_2024', 'שם חותם הברכה תשפד'],
        'add_logo_2024': ['add_logo_2024', 'הוספת לוגו תשפד'],
        'arrival_confirmation_method': ['arrival_confirmation_method', 'אופן אישור הגעה'],
        'couple_participation': ['couple_participation', 'השתתפות זוגית'],
        
        // הושבות גברים
        'men_seating_feb': ['men_seating_feb', 'הושבה גברים פד'],
        'men_temporary_seating_feb': ['men_temporary_seating_feb', 'הושבה זמני גברים פד'],
        'men_table_number': ['men_table_number', 'מספר שולחן גברים'],
        'men_participation_dinner_feb': ['men_participation_dinner_feb', 'השתתפות גברים דינר פד'],
        'men_arrived_dinner_feb': ['men_arrived_dinner_feb', 'הגיע לדינר פד גברים'],
        
        // הושבות נשים
        'women_seating_feb': ['women_seating_feb', 'הושבה נשים פד'],
        'women_temporary_seating_feb': ['women_temporary_seating_feb', 'הושבה זמני נשים פד'],
        'women_table_number': ['women_table_number', 'מספר שולחן נשים'],
        'women_participation_dinner_feb': ['women_participation_dinner_feb', 'השתתפות נשים דינר פד'],
        'women_arrived_dinner_feb': ['women_arrived_dinner_feb', 'הגיע לדינר פד נשים'],
        'women_title_before': ['women_title_before', 'תואר לפני נשים'],
        
        // כללי
        'table_style': ['table_style', 'סגנון שולחן'],
        'temporary_table_seating_dinner_feb': ['temporary_table_seating_dinner_feb', 'הושבה שולחן זמני דינר פד'],
        'seat_near_main': ['seat_near_main', 'ליד מי תרצו לשבת'],
        'seat_near_participant_1': ['seat_near_participant_1', 'ליד מי תרצו לשבת (משתתף 1)'],
        'seat_near_participant_2': ['seat_near_participant_2', 'ליד מי תרצו לשבת (משתתף 2)'],
        'donor_status': ['donor_status', 'סטאטוס תורם'],
        'donor_style': ['donor_style', 'סגנון תורם'],
        'occupation_style': ['occupation_style', 'סגנון עיסוק'],
        'collection_status_dinner_feb': ['collection_status_dinner_feb', 'סטטוס גביה דינר פד'],
        'form_check': ['form_check', 'בדיקה טפסים'],
        'not_participating': ['not_participating', 'לא משתתף'],
        'license_plate': ['license_plate', 'לוחית רישוי'],
        'parking_entry': ['parking_entry', 'כניסה לחניה']
      };
      
      // יצירת custom fields לכל עמודה שלא נמצאת בשדות הבסיסיים
      const customFieldsMap = {}; // {columnName: fieldId}
      for (const column of allColumns) {
        // בדיקה אם זה שדה בסיסי
        let isBaseField = false;
        for (const baseKey in baseFieldMapping) {
          if (baseFieldMapping[baseKey].some(alias => alias.toLowerCase() === column.toLowerCase())) {
            isBaseField = true;
            break;
          }
        }
        
        // אם זה לא שדה בסיסי, צור custom field
        if (!isBaseField && column.trim()) {
          try {
            // בדיקה אם השדה כבר קיים
            const existingFields = await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields`, {
              headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json()).catch(() => []);
            
            // חיפוש שדה קיים - גם עם prefix וגם בלי
            let fieldId = existingFields.find(f => {
              const fieldName = f.name || '';
              // הסרת prefix אם יש
              const nameWithoutPrefix = fieldName.includes('] ') ? fieldName.split('] ')[1] : fieldName;
              // הסרת * אם יש
              const cleanName = nameWithoutPrefix.replace(/\s*\*$/, '').trim();
              return cleanName === column || fieldName === column;
            })?.id;
            
            if (!fieldId) {
              // יצירת שדה חדש
              const createFieldRes = await fetch(`http://localhost:8001/guests/events/${eventId}/form-fields`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json', 
                  'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                  field_name: column,
                  field_type: 'text'
                })
              });
              
              if (createFieldRes.ok) {
                const newField = await createFieldRes.json();
                fieldId = newField.id;
              } else {
                // נסה דרך endpoint אחר
                try {
                  const altRes = await fetch(`http://localhost:8001/guests/custom-field/`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json', 
                      'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({
                      event_id: Number(eventId),
                      name: column,
                      field_type: 'text'
                    })
                  });
                  if (altRes.ok) {
                    const altField = await altRes.json();
                    fieldId = altField.id;
                  }
                } catch (err) {
                  console.error('Alternative field creation failed:', err);
                }
              }
            }
            
            if (fieldId) {
              customFieldsMap[column] = fieldId;
            }
          } catch (err) {
            console.error(`Error creating field for ${column}:`, err);
          }
        }
      }
      
      // שליפת כל המוזמנים הקיימים לבדיקת כפילויות
      const existingGuestsResponse = await fetch(`http://localhost:8001/guests/event/${eventId}/with-fields`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const existingGuests = await existingGuestsResponse.json().catch(() => []);
      
      // פונקציה לנרמול תעודת זהות
      const normalizeIdNumber = (id) => {
        if (!id) return '';
        return String(id).replace(/\D/g, ''); // רק ספרות
      };
      
      // בדיקת כפילויות והשוואת נתונים
      const duplicates = [];
      const rowsToCreate = [];
      
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const first_name = pickField(row, baseFieldMapping['first_name']);
        const last_name = pickField(row, baseFieldMapping['last_name']);
        
        if ((!first_name || !first_name.trim()) && (!last_name || !last_name.trim())) {
          continue; // דלג על שורות ללא שם
        }
        
        const id_number = pickField(row, baseFieldMapping['id_number']);
        const normalized_id_check = (id_number || '').trim();
        if (!normalized_id_check || normalized_id_check === '-') {
          // אם אין תעודת זהות או שהערך הוא '-', נוסיף ליצירה (עם ID ייחודי)
          rowsToCreate.push({ row, rowIndex });
          continue;
        }
        
        // חיפוש מוזמן קיים לפי תעודת זהות
        const normalizedId = normalizeIdNumber(id_number);
        const existingGuest = existingGuests.find(g => {
          const existingId = normalizeIdNumber(g['תעודת זהות'] || g.id_number || '');
          return existingId && existingId === normalizedId;
        });
        
        if (!existingGuest) {
          // אין מוזמן קיים - נוסיף ליצירה
          rowsToCreate.push({ row, rowIndex });
          continue;
        }
        
        // יש מוזמן קיים - השוואת נתונים
        const phone = pickField(row, baseFieldMapping['phone']);
        const email = pickField(row, baseFieldMapping['email']);
        const address = pickField(row, baseFieldMapping['address']);
        const referral_source = pickField(row, baseFieldMapping['referral_source']);
        const whatsapp_number = pickField(row, baseFieldMapping['whatsapp_number']);
        const genderRaw = pickField(row, baseFieldMapping['gender']);
        const gender = normalizeGender(genderRaw || 'male');
        
        // השוואת שדות בסיסיים
        const newData = {
          first_name: (first_name && first_name.trim()) || 'ללא שם',
          last_name: (last_name && last_name.trim()) || 'ללא שם משפחה',
          phone: phone || '',
          email: email || '',
          address: address || '',
          referral_source: referral_source || '',
          whatsapp_number: whatsapp_number || '',
          gender: gender || 'male',
          customFields: {}
        };
        
        // הוספת כל השדות הדינמיים
        for (const column of allColumns) {
          const value = String(row[column] || '').trim();
          if (value || value === '0') {
            newData.customFields[column] = value;
          }
        }
        
        // השוואת נתונים
        const existingData = {
          first_name: existingGuest['שם'] || existingGuest.first_name || '',
          last_name: existingGuest['שם משפחה'] || existingGuest.last_name || '',
          phone: existingGuest['טלפון'] || existingGuest.phone || '',
          email: existingGuest['אימייל'] || existingGuest.email || '',
          address: existingGuest['כתובת'] || existingGuest.address || '',
          referral_source: existingGuest['מקור הפניה'] || existingGuest.referral_source || '',
          whatsapp_number: existingGuest['מספר וואטסאפ'] || existingGuest.whatsapp_number || '',
          gender: existingGuest.gender || 'male',
          customFields: {}
        };
        
        // הוספת שדות דינמיים קיימים
        for (const key in existingGuest) {
          if (!['id', 'שם', 'שם משפחה', 'טלפון', 'אימייל', 'תעודת זהות', 'כתובת', 'מקור הפניה', 'מספר וואטסאפ', 'gender', 'confirmed_arrival', 'table_head_id'].includes(key)) {
            existingData.customFields[key] = existingGuest[key] || '';
          }
        }
        
        // בדיקה אם הנתונים זהים
        let isIdentical = true;
        const differences = [];
        
        for (const key in newData) {
          if (key === 'customFields') continue;
          if (String(newData[key] || '').trim() !== String(existingData[key] || '').trim()) {
            isIdentical = false;
            differences.push({ field: key, old: existingData[key], new: newData[key] });
          }
        }
        
        // השוואת שדות דינמיים
        const allCustomFields = new Set([...Object.keys(newData.customFields), ...Object.keys(existingData.customFields)]);
        for (const field of allCustomFields) {
          if (String(newData.customFields[field] || '').trim() !== String(existingData.customFields[field] || '').trim()) {
            isIdentical = false;
            differences.push({ field, old: existingData.customFields[field] || '', new: newData.customFields[field] || '' });
          }
        }
        
        if (!isIdentical) {
          // יש הבדלים - הוסף לרשימת כפילויות
          duplicates.push({
            rowIndex,
            existingGuest: { ...existingGuest, ...existingData },
            newData,
            allColumns,
            row,
            differences
          });
        }
        // אם זהים - לא נעשה כלום (דלג)
      }
      
      // אם יש כפילויות עם הבדלים, הצג דיאלוג
      if (duplicates.length > 0) {
        setDuplicateGuests(duplicates);
        setPendingImportData({ rows: rowsToCreate, customFieldsMap, allColumns, baseFieldMapping, file: file.name });
        setShowDuplicateDialog(true);
        setUploading(false);
        e.target.value = '';
        return;
      }
      
      // אין כפילויות - המשך ליצירה רגילה
      // טען את רשימת השדות פעם אחת לפני הלולאה
      const existingFields = await fetch(`http://localhost:8001/guests/custom-field/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).catch(() => []);
      
      const createOne = async ({ row, rowIndex }) => {
        // ניסיון להרכיב שם מלא משדות שונים
        const first_name = pickField(row, baseFieldMapping['first_name']);
        const last_name = pickField(row, baseFieldMapping['last_name']);
        
        // וודא שיש לפחות שם פרטי או שם משפחה
        if ((!first_name || !first_name.trim()) && (!last_name || !last_name.trim())) {
          return { ok: false, reason: 'חסר שם' };
        }
        
        const id_number = pickField(row, baseFieldMapping['id_number']);
        // אם אין תעודת זהות או שהערך הוא '-' או ריק, נשתמש בערך ברירת מחדל (מספר ייחודי)
        const normalized_id = (id_number || '').trim();
        const final_id_number = (normalized_id && normalized_id !== '-') 
          ? normalized_id 
          : `temp_${Date.now()}_${rowIndex}_${Math.random().toString(36).substr(2, 9)}`;
        
        const phone = pickField(row, baseFieldMapping['phone']);
        const email = pickField(row, baseFieldMapping['email']);
        const address = pickField(row, baseFieldMapping['address']);
        const referral_source = pickField(row, baseFieldMapping['referral_source']);
        const whatsapp_number = pickField(row, baseFieldMapping['whatsapp_number']);
        const genderRaw = pickField(row, baseFieldMapping['gender']);
        const gender = normalizeGender(genderRaw || 'male'); // ברירת מחדל male אם לא נמצא
        const tableHeadName = pickField(row, baseFieldMapping['table_head']);
        let table_head_id = null;
        if (tableHeadName) {
          const found = tableHeads.find(th => (th.last_name || '').trim() === tableHeadName.trim());
          if (found) table_head_id = found.id;
        }
        // פונקציה עזר לשליפת שדה
        const getField = (key) => {
          const value = pickField(row, baseFieldMapping[key]);
          return value ? String(value).trim() : '';
        };
        
        const payload = {
          event_id: Number(eventId),
          first_name: (first_name && first_name.trim()) || 'ללא שם',
          last_name: (last_name && last_name.trim()) || 'ללא שם משפחה',
          id_number: final_id_number,
          address: address || '',
          phone: phone || '',
          email: email || '',
          referral_source: referral_source || '',
          whatsapp_number: whatsapp_number || '',
          gender: gender || 'male',
          table_head_id,
          
          // פרטים אישיים
          middle_name: getField('middle_name'),
          first_name_split: getField('first_name_split'),
          last_name_split: getField('last_name_split'),
          first_name_without_wife: getField('first_name_without_wife'),
          title_before: getField('title_before'),
          title_after: getField('title_after'),
          nickname: getField('nickname'),
          spouse_name: getField('spouse_name'),
          wife_name: getField('wife_name'),
          wife_name_dinner: getField('wife_name_dinner'),
          age: getField('age') ? parseInt(getField('age')) : null,
          birth_date: getField('birth_date') || null,
          student_code: getField('student_code'),
          language: getField('language'),
          
          // פרטי קשר
          mobile_phone: getField('mobile_phone'),
          home_phone: getField('home_phone'),
          alt_phone_1: getField('alt_phone_1'),
          alt_phone_2: getField('alt_phone_2'),
          email_2: getField('email_2'),
          alt_email: getField('alt_email'),
          work_email: getField('work_email'),
          wife_phone: getField('wife_phone'),
          
          // מזהים
          identifier: getField('identifier'),
          import_identifier: getField('import_identifier'),
          manager_personal_number: getField('manager_personal_number'),
          card_id: getField('card_id'),
          raf: getField('raf'),
          previous_system_id: getField('previous_system_id'),
          
          // שיוך וניהול
          groups: getField('groups'),
          email_group: getField('email_group'),
          user_link: getField('user_link'),
          ambassador_id: getField('ambassador_id'),
          ambassador: getField('ambassador'),
          marked_as_ambassador: getField('marked_as_ambassador') === 'true' || getField('marked_as_ambassador') === '1',
          ambassador_status: getField('ambassador_status'),
          display_type: getField('display_type'),
          telephonist_assignment: getField('telephonist_assignment'),
          telephonist_update: getField('telephonist_update'),
          category: getField('category'),
          women_category: getField('women_category'),
          invitation_classification: getField('invitation_classification'),
          arrival_source: getField('arrival_source'),
          synagogue: getField('synagogue'),
          treatment_status: getField('treatment_status'),
          
          // טלפניות ושיחות
          eligibility_status_for_leads: getField('eligibility_status_for_leads'),
          requested_return_date: getField('requested_return_date') || null,
          last_telephonist_call: getField('last_telephonist_call') || null,
          last_call_status: getField('last_call_status'),
          notes: getField('notes'),
          telephonist_notes: getField('telephonist_notes'),
          status_description: getField('status_description'),
          
          // כתובת ראשית
          street: getField('street'),
          building_number: getField('building_number'),
          apartment_number: getField('apartment_number'),
          city: getField('city'),
          neighborhood: getField('neighborhood'),
          postal_code: getField('postal_code'),
          country: getField('country'),
          state: getField('state'),
          mailing_address: getField('mailing_address'),
          recipient_name: getField('recipient_name'),
          
          // בנקים ותשלומים
          bank: getField('bank'),
          branch: getField('branch'),
          account_number: getField('account_number'),
          bank_account_name: getField('bank_account_name'),
          credit_card_number: getField('credit_card_number'),
          
          // תרומות
          is_hok_active: getField('is_hok_active') === 'true' || getField('is_hok_active') === '1',
          active_hok: getField('active_hok'),
          hok_amount_05_2024: getField('hok_amount_05_2024'),
          monthly_hok_amount: getField('monthly_hok_amount'),
          donation: getField('donation'),
          monthly_hok_amount_nis: getField('monthly_hok_amount_nis'),
          payment: getField('payment'),
          hok_amount_05_24: getField('hok_amount_05_24'),
          receipt_sending_concentration: getField('receipt_sending_concentration'),
          last_payment_date: getField('last_payment_date') || null,
          last_payment_amount: getField('last_payment_amount'),
          last_transaction_date: getField('last_transaction_date') || null,
          last_transaction_amount: getField('last_transaction_amount'),
          donations_payments_last_year: getField('donations_payments_last_year'),
          total_donations_payments: getField('total_donations_payments'),
          max_one_time_donation: getField('max_one_time_donation'),
          max_recurring_donation: getField('max_recurring_donation'),
          donation_commitment: getField('donation_commitment'),
          donation_ability: getField('donation_ability'),
          
          // היסטוריית תרומות
          donations_2019: getField('donations_2019'),
          donations_2020: getField('donations_2020'),
          total_donations_2021: getField('total_donations_2021'),
          total_donations_2022: getField('total_donations_2022'),
          total_donations_2023: getField('total_donations_2023'),
          total_donations_2024: getField('total_donations_2024'),
          total_donations_2019_2023: getField('total_donations_2019_2023'),
          donated_this_year_2024: getField('donated_this_year_2024'),
          total_donations: getField('total_donations'),
          
          // אירועים ודינרים
          dinners_participated: getField('dinners_participated'),
          assigned_to_dinners: getField('assigned_to_dinners'),
          dinner_2024_invited_by_amount: getField('dinner_2024_invited_by_amount'),
          dinner_2022_invited: getField('dinner_2022_invited'),
          seating_dinner_feb: getField('seating_dinner_feb'),
          seating_dinner_2019: getField('seating_dinner_2019'),
          participation_dinner_feb: getField('participation_dinner_feb'),
          sponsorship_blessing_status: getField('sponsorship_blessing_status'),
          dinner_contact_person_name: getField('dinner_contact_person_name'),
          dinner_contact_person_full_name: getField('dinner_contact_person_full_name'),
          blessing_content_dinner_2024: getField('blessing_content_dinner_2024'),
          blessing_signer_2024: getField('blessing_signer_2024'),
          add_logo_2024: getField('add_logo_2024'),
          arrival_confirmation_method: getField('arrival_confirmation_method'),
          couple_participation: getField('couple_participation'),
          
          // הושבות גברים
          men_seating_feb: getField('men_seating_feb'),
          men_temporary_seating_feb: getField('men_temporary_seating_feb'),
          men_table_number: getField('men_table_number'),
          men_participation_dinner_feb: getField('men_participation_dinner_feb'),
          men_arrived_dinner_feb: getField('men_arrived_dinner_feb') === 'true' || getField('men_arrived_dinner_feb') === '1',
          
          // הושבות נשים
          women_seating_feb: getField('women_seating_feb'),
          women_temporary_seating_feb: getField('women_temporary_seating_feb'),
          women_table_number: getField('women_table_number'),
          women_participation_dinner_feb: getField('women_participation_dinner_feb'),
          women_arrived_dinner_feb: getField('women_arrived_dinner_feb') === 'true' || getField('women_arrived_dinner_feb') === '1',
          women_title_before: getField('women_title_before'),
          
          // כללי
          table_style: getField('table_style'),
          temporary_table_seating_dinner_feb: getField('temporary_table_seating_dinner_feb'),
          seat_near_main: getField('seat_near_main'),
          seat_near_participant_1: getField('seat_near_participant_1'),
          seat_near_participant_2: getField('seat_near_participant_2'),
          donor_status: getField('donor_status'),
          donor_style: getField('donor_style'),
          occupation_style: getField('occupation_style'),
          collection_status_dinner_feb: getField('collection_status_dinner_feb'),
          form_check: getField('form_check'),
          not_participating: getField('not_participating') === 'true' || getField('not_participating') === '1',
          license_plate: getField('license_plate'),
          parking_entry: getField('parking_entry')
        };
        const res = await fetch('http://localhost:8001/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          return { ok: false, reason: txt || String(res.status) };
        }
        const json = await res.json().catch(() => null);
        if (!json || !json.id) return { ok: false, reason: 'לא התקבל ID' };
        const guestId = json.id;
        createdIds.push(guestId);
        
        // שמירת כל השדות הדינמיים
        for (const column in customFieldsMap) {
          const fieldId = customFieldsMap[column];
          const value = String(row[column] || '').trim();
          if (value || value === '0') {
            try {
              // מצא את שם השדה הנכון (עם prefix אם יש) - השתמש ברשימה שכבר נטענה
              const field = existingFields.find(f => f.id === fieldId);
              const fieldName = field ? field.name : column;
              
              // הסרת prefix מהשם אם יש (לצורך החיפוש)
              let searchName = fieldName;
              if (fieldName.includes('] ')) {
                searchName = fieldName.split('] ')[1];
              }
              searchName = searchName.replace(/\s*\*$/, '').trim();
              
              await fetch(`http://localhost:8001/guests/events/${eventId}/guests/${guestId}/field-values`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json', 
                  'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                  guest_id: guestId,
                  field_name: searchName === column ? fieldName : column,
                  value: value
                })
              });
            } catch (err) {
              console.error(`Error saving field ${column}:`, err);
            }
          }
        }
        
        return { ok: true };
      };

      const results = await Promise.allSettled(rowsToCreate.map(createOne));
      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
      const failed = results.length - succeeded;

      // רענון רשימות
      const [guestsWithFieldsData, guestsRawData, customFieldsData] = await Promise.all([
        fetch(`http://localhost:8001/guests/event/${eventId}/with-fields`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()),
        fetch(`http://localhost:8001/guests/event/${eventId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()),
        fetch(`http://localhost:8001/guests/custom-field/${eventId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => [])
      ]);
      setGuests(Array.isArray(guestsWithFieldsData) ? guestsWithFieldsData : []);
      setGuestsRaw(Array.isArray(guestsRawData) ? guestsRawData : []);
      setAllCustomFields(Array.isArray(customFieldsData) ? customFieldsData : []);

      // שמירת מידע הייבוא
      const info = { filename: file.name, ids: createdIds, uploadedAt: Date.now() };
      setImportInfos((prev) => {
        const next = [...(Array.isArray(prev) ? prev : []), info];
        saveImportInfos(eventId, next);
        return next;
      });

      alert(`ייבוא הושלם: נוספו ${succeeded} שורות, נכשלו ${failed}`);
      e.target.value = '';
    } catch (err) {
      console.error(err);
      alert('שגיאה בקריאת הקובץ');
    } finally {
      setUploading(false);
    }
  };

  // פונקציה לעדכון מוזמנים קיימים
  const handleUpdateGuests = async () => {
    if (!pendingImportData || duplicateGuests.length === 0) return;
    
    const selectedForUpdate = duplicateGuests.filter(dup => guestsToUpdate.includes(dup.rowIndex));
    if (selectedForUpdate.length === 0) {
      alert('לא נבחרו מוזמנים לעדכון');
      return;
    }
    
    try {
      setUploading(true);
      const token = localStorage.getItem('access_token');
      const { customFieldsMap, allColumns, baseFieldMapping } = pendingImportData;
      let updatedCount = 0;
      let failedCount = 0;
      
      for (const dup of selectedForUpdate) {
        try {
          const existingGuestId = dup.existingGuest.id || dup.existingGuest.guest?.id;
          if (!existingGuestId) {
            failedCount++;
            continue;
          }
          
          const { newData, row } = dup;
          
          // עדכון שדות בסיסיים
          const tableHeadName = pickField(row, baseFieldMapping['table_head']);
          let table_head_id = dup.existingGuest.table_head_id || null;
          if (tableHeadName) {
            const found = tableHeads.find(th => (th.last_name || '').trim() === tableHeadName.trim());
            if (found) table_head_id = found.id;
          }
          
          const updatePayload = {
            first_name: newData.first_name,
            last_name: newData.last_name,
            id_number: dup.existingGuest['תעודת זהות'] || dup.existingGuest.id_number || '',
            address: newData.address,
            phone: newData.phone,
            email: newData.email,
            referral_source: newData.referral_source,
            whatsapp_number: newData.whatsapp_number,
            gender: newData.gender,
            table_head_id
          };
          
          const updateRes = await fetch(`http://localhost:8001/guests/${existingGuestId}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(updatePayload)
          });
          
          if (!updateRes.ok) {
            failedCount++;
            continue;
          }
          
          // עדכון שדות דינמיים
          // שליפת כל הערכים הקיימים של המוזמן
          const existingFieldValues = await fetch(`http://localhost:8001/guests/field-value/${existingGuestId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()).catch(() => []);
          
          const existingFields = await fetch(`http://localhost:8001/guests/custom-field/${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.json()).catch(() => []);
          
          for (const column in newData.customFields) {
            const value = String(newData.customFields[column] || '').trim();
            if (value || value === '0') {
              try {
                const field = existingFields.find(f => {
                  const fieldName = f.name || '';
                  const nameWithoutPrefix = fieldName.includes('] ') ? fieldName.split('] ')[1] : fieldName;
                  const cleanName = nameWithoutPrefix.replace(/\s*\*$/, '').trim();
                  return cleanName === column || fieldName === column;
                });
                
                if (field) {
                  const fieldName = field.name;
                  let searchName = fieldName;
                  if (fieldName.includes('] ')) {
                    searchName = fieldName.split('] ')[1];
                  }
                  searchName = searchName.replace(/\s*\*$/, '').trim();
                  
                  // בדיקה אם יש ערך קיים
                  const existingValue = existingFieldValues.find(fv => fv.custom_field_id === field.id);
                  
                  if (existingValue) {
                    // עדכון ערך קיים - נשתמש ב-POST שיוצר/מעדכן
                    // (אם יש כפילות, השרת יטפל בזה)
                    await fetch(`http://localhost:8001/guests/events/${eventId}/guests/${existingGuestId}/field-values`, {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${token}` 
                      },
                      body: JSON.stringify({
                        guest_id: existingGuestId,
                        field_name: searchName === column ? fieldName : column,
                        value: value
                      })
                    });
                  } else {
                    // יצירת ערך חדש
                    await fetch(`http://localhost:8001/guests/events/${eventId}/guests/${existingGuestId}/field-values`, {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${token}` 
                      },
                      body: JSON.stringify({
                        guest_id: existingGuestId,
                        field_name: searchName === column ? fieldName : column,
                        value: value
                      })
                    });
                  }
                }
              } catch (err) {
                console.error(`Error updating field ${column}:`, err);
              }
            }
          }
          
          updatedCount++;
        } catch (err) {
          console.error('Error updating guest:', err);
          failedCount++;
        }
      }
      
      // יצירת מוזמנים חדשים
      // טען את רשימת השדות פעם אחת לפני הלולאה
      const existingFieldsForCreate = await fetch(`http://localhost:8001/guests/custom-field/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()).catch(() => []);
      
      const createOne = async ({ row, rowIndex }) => {
        const first_name = pickField(row, baseFieldMapping['first_name']);
        const last_name = pickField(row, baseFieldMapping['last_name']);
        
        if ((!first_name || !first_name.trim()) && (!last_name || !last_name.trim())) {
          return { ok: false, reason: 'חסר שם' };
        }
        
        const id_number = pickField(row, baseFieldMapping['id_number']);
        // אם אין תעודת זהות או שהערך הוא '-' או ריק, נשתמש בערך ברירת מחדל (מספר ייחודי)
        const normalized_id = (id_number || '').trim();
        const final_id_number = (normalized_id && normalized_id !== '-') 
          ? normalized_id 
          : `temp_${Date.now()}_${rowIndex}_${Math.random().toString(36).substr(2, 9)}`;
        
        const phone = pickField(row, baseFieldMapping['phone']);
        const email = pickField(row, baseFieldMapping['email']);
        const address = pickField(row, baseFieldMapping['address']);
        const referral_source = pickField(row, baseFieldMapping['referral_source']);
        const whatsapp_number = pickField(row, baseFieldMapping['whatsapp_number']);
        const genderRaw = pickField(row, baseFieldMapping['gender']);
        const gender = normalizeGender(genderRaw || 'male');
        const tableHeadName = pickField(row, baseFieldMapping['table_head']);
        let table_head_id = null;
        if (tableHeadName) {
          const found = tableHeads.find(th => (th.last_name || '').trim() === tableHeadName.trim());
          if (found) table_head_id = found.id;
        }
        
        // פונקציה עזר לשליפת שדה
        const getField = (key) => {
          const value = pickField(row, baseFieldMapping[key]);
          return value ? String(value).trim() : '';
        };
        
        const payload = {
          event_id: Number(eventId),
          first_name: (first_name && first_name.trim()) || 'ללא שם',
          last_name: (last_name && last_name.trim()) || 'ללא שם משפחה',
          id_number: final_id_number,
          address: address || '',
          phone: phone || '',
          email: email || '',
          referral_source: referral_source || '',
          whatsapp_number: whatsapp_number || '',
          gender: gender || 'male',
          table_head_id,
          
          // פרטים אישיים
          middle_name: getField('middle_name'),
          first_name_split: getField('first_name_split'),
          last_name_split: getField('last_name_split'),
          first_name_without_wife: getField('first_name_without_wife'),
          title_before: getField('title_before'),
          title_after: getField('title_after'),
          nickname: getField('nickname'),
          spouse_name: getField('spouse_name'),
          wife_name: getField('wife_name'),
          wife_name_dinner: getField('wife_name_dinner'),
          age: getField('age') ? parseInt(getField('age')) : null,
          birth_date: getField('birth_date') || null,
          student_code: getField('student_code'),
          language: getField('language'),
          
          // פרטי קשר
          mobile_phone: getField('mobile_phone'),
          home_phone: getField('home_phone'),
          alt_phone_1: getField('alt_phone_1'),
          alt_phone_2: getField('alt_phone_2'),
          email_2: getField('email_2'),
          alt_email: getField('alt_email'),
          work_email: getField('work_email'),
          wife_phone: getField('wife_phone'),
          
          // מזהים
          identifier: getField('identifier'),
          import_identifier: getField('import_identifier'),
          manager_personal_number: getField('manager_personal_number'),
          card_id: getField('card_id'),
          raf: getField('raf'),
          previous_system_id: getField('previous_system_id'),
          
          // שיוך וניהול
          groups: getField('groups'),
          email_group: getField('email_group'),
          user_link: getField('user_link'),
          ambassador_id: getField('ambassador_id'),
          ambassador: getField('ambassador'),
          marked_as_ambassador: getField('marked_as_ambassador') === 'true' || getField('marked_as_ambassador') === '1',
          ambassador_status: getField('ambassador_status'),
          display_type: getField('display_type'),
          telephonist_assignment: getField('telephonist_assignment'),
          telephonist_update: getField('telephonist_update'),
          category: getField('category'),
          women_category: getField('women_category'),
          invitation_classification: getField('invitation_classification'),
          arrival_source: getField('arrival_source'),
          synagogue: getField('synagogue'),
          treatment_status: getField('treatment_status'),
          
          // טלפניות ושיחות
          eligibility_status_for_leads: getField('eligibility_status_for_leads'),
          requested_return_date: getField('requested_return_date') || null,
          last_telephonist_call: getField('last_telephonist_call') || null,
          last_call_status: getField('last_call_status'),
          notes: getField('notes'),
          telephonist_notes: getField('telephonist_notes'),
          status_description: getField('status_description'),
          
          // כתובת ראשית
          street: getField('street'),
          building_number: getField('building_number'),
          apartment_number: getField('apartment_number'),
          city: getField('city'),
          neighborhood: getField('neighborhood'),
          postal_code: getField('postal_code'),
          country: getField('country'),
          state: getField('state'),
          mailing_address: getField('mailing_address'),
          recipient_name: getField('recipient_name'),
          
          // בנקים ותשלומים
          bank: getField('bank'),
          branch: getField('branch'),
          account_number: getField('account_number'),
          bank_account_name: getField('bank_account_name'),
          credit_card_number: getField('credit_card_number'),
          
          // תרומות
          is_hok_active: getField('is_hok_active') === 'true' || getField('is_hok_active') === '1',
          active_hok: getField('active_hok'),
          hok_amount_05_2024: getField('hok_amount_05_2024'),
          monthly_hok_amount: getField('monthly_hok_amount'),
          donation: getField('donation'),
          monthly_hok_amount_nis: getField('monthly_hok_amount_nis'),
          payment: getField('payment'),
          hok_amount_05_24: getField('hok_amount_05_24'),
          receipt_sending_concentration: getField('receipt_sending_concentration'),
          last_payment_date: getField('last_payment_date') || null,
          last_payment_amount: getField('last_payment_amount'),
          last_transaction_date: getField('last_transaction_date') || null,
          last_transaction_amount: getField('last_transaction_amount'),
          donations_payments_last_year: getField('donations_payments_last_year'),
          total_donations_payments: getField('total_donations_payments'),
          max_one_time_donation: getField('max_one_time_donation'),
          max_recurring_donation: getField('max_recurring_donation'),
          donation_commitment: getField('donation_commitment'),
          donation_ability: getField('donation_ability'),
          
          // היסטוריית תרומות
          donations_2019: getField('donations_2019'),
          donations_2020: getField('donations_2020'),
          total_donations_2021: getField('total_donations_2021'),
          total_donations_2022: getField('total_donations_2022'),
          total_donations_2023: getField('total_donations_2023'),
          total_donations_2024: getField('total_donations_2024'),
          total_donations_2019_2023: getField('total_donations_2019_2023'),
          donated_this_year_2024: getField('donated_this_year_2024'),
          total_donations: getField('total_donations'),
          
          // אירועים ודינרים
          dinners_participated: getField('dinners_participated'),
          assigned_to_dinners: getField('assigned_to_dinners'),
          dinner_2024_invited_by_amount: getField('dinner_2024_invited_by_amount'),
          dinner_2022_invited: getField('dinner_2022_invited'),
          seating_dinner_feb: getField('seating_dinner_feb'),
          seating_dinner_2019: getField('seating_dinner_2019'),
          participation_dinner_feb: getField('participation_dinner_feb'),
          sponsorship_blessing_status: getField('sponsorship_blessing_status'),
          dinner_contact_person_name: getField('dinner_contact_person_name'),
          dinner_contact_person_full_name: getField('dinner_contact_person_full_name'),
          blessing_content_dinner_2024: getField('blessing_content_dinner_2024'),
          blessing_signer_2024: getField('blessing_signer_2024'),
          add_logo_2024: getField('add_logo_2024'),
          arrival_confirmation_method: getField('arrival_confirmation_method'),
          couple_participation: getField('couple_participation'),
          
          // הושבות גברים
          men_seating_feb: getField('men_seating_feb'),
          men_temporary_seating_feb: getField('men_temporary_seating_feb'),
          men_table_number: getField('men_table_number'),
          men_participation_dinner_feb: getField('men_participation_dinner_feb'),
          men_arrived_dinner_feb: getField('men_arrived_dinner_feb') === 'true' || getField('men_arrived_dinner_feb') === '1',
          
          // הושבות נשים
          women_seating_feb: getField('women_seating_feb'),
          women_temporary_seating_feb: getField('women_temporary_seating_feb'),
          women_table_number: getField('women_table_number'),
          women_participation_dinner_feb: getField('women_participation_dinner_feb'),
          women_arrived_dinner_feb: getField('women_arrived_dinner_feb') === 'true' || getField('women_arrived_dinner_feb') === '1',
          women_title_before: getField('women_title_before'),
          
          // כללי
          table_style: getField('table_style'),
          temporary_table_seating_dinner_feb: getField('temporary_table_seating_dinner_feb'),
          seat_near_main: getField('seat_near_main'),
          seat_near_participant_1: getField('seat_near_participant_1'),
          seat_near_participant_2: getField('seat_near_participant_2'),
          donor_status: getField('donor_status'),
          donor_style: getField('donor_style'),
          occupation_style: getField('occupation_style'),
          collection_status_dinner_feb: getField('collection_status_dinner_feb'),
          form_check: getField('form_check'),
          not_participating: getField('not_participating') === 'true' || getField('not_participating') === '1',
          license_plate: getField('license_plate'),
          parking_entry: getField('parking_entry')
        };
        
        const res = await fetch('http://localhost:8001/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          return { ok: false, reason: String(res.status) };
        }
        
        const json = await res.json().catch(() => null);
        if (!json || !json.id) return { ok: false, reason: 'לא התקבל ID' };
        const guestId = json.id;
        
        // שמירת שדות דינמיים
        for (const column in customFieldsMap) {
          const fieldId = customFieldsMap[column];
          const value = String(row[column] || '').trim();
          if (value || value === '0') {
            try {
              // השתמש ברשימה שכבר נטענה - existingFieldsForCreate
              const field = existingFieldsForCreate.find(f => f.id === fieldId);
              const fieldName = field ? field.name : column;
              
              let searchName = fieldName;
              if (fieldName.includes('] ')) {
                searchName = fieldName.split('] ')[1];
              }
              searchName = searchName.replace(/\s*\*$/, '').trim();
              
              await fetch(`http://localhost:8001/guests/events/${eventId}/guests/${guestId}/field-values`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json', 
                  'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                  guest_id: guestId,
                  field_name: searchName === column ? fieldName : column,
                  value: value
                })
              });
            } catch (err) {
              console.error(`Error saving field ${column}:`, err);
            }
          }
        }
        
        return { ok: true };
      };
      
      const createResults = await Promise.allSettled(pendingImportData.rows.map(createOne));
      const createdCount = createResults.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
      
      // רענון רשימות
      const [guestsWithFieldsData, guestsRawData, customFieldsData] = await Promise.all([
        fetch(`http://localhost:8001/guests/event/${eventId}/with-fields`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()),
        fetch(`http://localhost:8001/guests/event/${eventId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()),
        fetch(`http://localhost:8001/guests/custom-field/${eventId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).catch(() => [])
      ]);
      setGuests(Array.isArray(guestsWithFieldsData) ? guestsWithFieldsData : []);
      setGuestsRaw(Array.isArray(guestsRawData) ? guestsRawData : []);
      setAllCustomFields(Array.isArray(customFieldsData) ? customFieldsData : []);
      
      // שמירת מידע הייבוא
      const info = { filename: pendingImportData.file, ids: [], uploadedAt: Date.now() };
      setImportInfos((prev) => {
        const next = [...(Array.isArray(prev) ? prev : []), info];
        saveImportInfos(eventId, next);
        return next;
      });
      
      setShowDuplicateDialog(false);
      setDuplicateGuests([]);
      setGuestsToUpdate([]);
      setPendingImportData(null);
      
      alert(`ייבוא הושלם: עודכנו ${updatedCount} מוזמנים, נוספו ${createdCount} מוזמנים חדשים${failedCount > 0 ? `, נכשלו ${failedCount}` : ''}`);
    } catch (err) {
      console.error(err);
      alert('שגיאה בעדכון מוזמנים');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImport = async (index) => {
    const info = Array.isArray(importInfos) ? importInfos[index] : null;
    if (!info) return;

    if (!Array.isArray(info.ids) || info.ids.length === 0) {
      // לא נוצרו רשומות חדשות – רק הסר מהיסטוריה
      const next = importInfos.filter((_, i) => i !== index);
      setImportInfos(next);
      saveImportInfos(eventId, next);
      return;
    }

    if (!window.confirm(`למחוק את הייבוא של "${info.filename}" ולסלק ${info.ids.length} מוזמנים שנוצרו?`)) return;

    try {
      setUploading(true);
      const token = localStorage.getItem('access_token');
      const delOne = async (id) => fetch(`http://localhost:8001/guests/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const results = await Promise.allSettled(info.ids.map(delOne));
      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
      const failed = info.ids.length - succeeded;

      const next = importInfos.filter((_, i) => i !== index);
      setImportInfos(next);
      saveImportInfos(eventId, next);

      // רענון
      const [guestsWithFieldsData, guestsRawData, customFieldsData] = await Promise.all([
        fetch(`http://localhost:8001/guests/event/${eventId}/with-fields`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
        fetch(`http://localhost:8001/guests/event/${eventId}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
        fetch(`http://localhost:8001/guests/custom-field/${eventId}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()).catch(() => [])
      ]);
      setGuests(Array.isArray(guestsWithFieldsData) ? guestsWithFieldsData : []);
      setGuestsRaw(Array.isArray(guestsRawData) ? guestsRawData : []);
      setAllCustomFields(Array.isArray(customFieldsData) ? customFieldsData : []);
      alert(`נמחקו ${succeeded} רשומות${failed ? `, נכשלו ${failed}` : ''}`);
    } catch (e) {
      console.error(e);
      alert('שגיאה במחיקה');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = useCallback(async (guestId) => {
    try {
      const response = await fetch(`http://localhost:8001/guests/${guestId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      if (!response.ok) {
        let msg = "מחיקה נכשלה";
        try {
          const data = await response.json();
          if (data.detail) msg = data.detail;
        } catch {}
        alert(msg);
        return;
      }
      // רענון מהשרת
      const token = localStorage.getItem('access_token');
      const [guestsWithFieldsData, customFieldsData] = await Promise.all([
        fetch(`http://localhost:8001/guests/event/${eventId}/with-fields`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()),
        fetch(`http://localhost:8001/guests/custom-field/${eventId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()).catch(() => [])
      ]);
      setGuests(Array.isArray(guestsWithFieldsData) ? guestsWithFieldsData : []);
      setAllCustomFields(Array.isArray(customFieldsData) ? customFieldsData : []);
      alert("האורח נמחק בהצלחה!");
    } catch (error) {
      alert("שגיאה במחיקת אורח");
      console.error(error);
    }
  }, [eventId]);

  const role = localStorage.getItem("role");
  const isViewer = role === "viewer";

  // הגבלת מספר השורות לרינדור כדי למנוע קריסת הדפדפן
  const MAX_RENDER_ROWS = 1000; // ניתן להוריד ל-500 אם עדיין כבד

  // פונקציות יציבות להעברה לקומפוננטת השורה
  const handleEditTableHead = useCallback((guestId) => {
    setEditingTableHeadFor(guestId);
  }, []);

  const handleBlurTableHead = useCallback(() => {
    setEditingTableHeadFor(null);
  }, []);

  // רינדור שורות הטבלה - משתמשים בקומפוננטת GuestRow עם React.memo
  // כל שורה תרונדר מחדש רק אם ה-props שלה השתנו
  const tableRows = useMemo(() => {
    console.log("[tableRows] paginatedGuests length:", paginatedGuests.length);
    const rowsToRender = paginatedGuests.slice(0, MAX_RENDER_ROWS);
    const startIndex = (currentPage - 1) * itemsPerPage;
    
    return rowsToRender.map((g, idx) => {
      const guestRaw = guestsRawMap.get(g.id);
      const tableHeadId = guestRaw?.table_head_id;
      const tableHead = tableHeadId ? tableHeadsMap.get(Number(tableHeadId)) : null;
      const rowKeyBase = g.id || g.row_index || g.id_number || g.identifier || `row-${startIndex + idx}`;
      const rowKey = String(rowKeyBase);

      return (
        <GuestRow
          key={rowKey}
          guest={g}
          fields={fields}
          guestRaw={guestRaw}
          tableHead={tableHead}
          tableHeads={tableHeads}
          editingTableHeadFor={editingTableHeadFor}
          isViewer={isViewer}
          rowKey={rowKey}
          onTableHeadChange={handleTableHeadChange}
          onConfirmedArrivalChange={handleConfirmedArrivalChange}
          onDelete={handleDelete}
          onEditTableHead={handleEditTableHead}
          onBlurTableHead={handleBlurTableHead}
        />
      );
    });
  }, [paginatedGuests, fields, guestsRawMap, tableHeadsMap, tableHeads, editingTableHeadFor, isViewer, handleTableHeadChange, handleConfirmedArrivalChange, handleDelete, handleEditTableHead, handleBlurTableHead, currentPage, itemsPerPage]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748b' }}>
        טוען נתונים...
      </div>
    );
  }

  // מיפוי שמות שדות לעברית
  const getFieldLabel = (fieldName) => {
    const fieldLabels = {
      first_name: 'שם פרטי',
      last_name: 'שם משפחה',
      phone: 'טלפון',
      email: 'אימייל',
      address: 'כתובת',
      referral_source: 'מקור הפניה',
      whatsapp_number: 'מספר וואטסאפ',
      gender: 'מגדר'
    };
    return fieldLabels[fieldName] || fieldName;
  };

  return (
    <div style={{ flex: 1 }}>
      {/* דיאלוג כפילויות */}
      {showDuplicateDialog && duplicateGuests.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            maxWidth: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
              נמצאו מוזמנים קיימים עם נתונים שונים ({duplicateGuests.length})
            </h2>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>
              בחר את המוזמנים שברצונך לעדכן לפי הנתונים החדשים מהקובץ:
            </p>
            
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={guestsToUpdate.length === duplicateGuests.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setGuestsToUpdate(duplicateGuests.map(d => d.rowIndex));
                    } else {
                      setGuestsToUpdate([]);
                    }
                  }}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600, fontSize: 14 }}>בחר הכל</span>
              </label>
            </div>
            
            <div style={{ maxHeight: '50vh', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
              {duplicateGuests.map((dup, idx) => {
                const existingGuest = dup.existingGuest;
                const isSelected = guestsToUpdate.includes(dup.rowIndex);
                
                return (
                  <div key={idx} style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 12,
                    background: isSelected ? '#f0f9ff' : '#fff'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGuestsToUpdate([...guestsToUpdate, dup.rowIndex]);
                          } else {
                            setGuestsToUpdate(guestsToUpdate.filter(i => i !== dup.rowIndex));
                          }
                        }}
                        style={{ marginTop: 4, width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, color: '#0f172a' }}>
                          {existingGuest['שם'] || existingGuest.first_name} {existingGuest['שם משפחה'] || existingGuest.last_name}
                          <span style={{ marginInlineStart: 8, fontSize: 12, fontWeight: 400, color: '#64748b' }}>
                            (ת.ז: {existingGuest['תעודת זהות'] || existingGuest.id_number || 'ללא'})
                          </span>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, fontSize: 12 }}>
                          {dup.differences.map((diff, diffIdx) => (
                            <div key={diffIdx} style={{ 
                              padding: 8, 
                              background: '#f8fafc', 
                              borderRadius: 6,
                              border: '1px solid #e2e8f0'
                            }}>
                              <div style={{ fontWeight: 600, marginBottom: 4, color: '#475569' }}>
                                {getFieldLabel(diff.field)}:
                              </div>
                              <div style={{ color: '#ef4444', textDecoration: 'line-through', marginBottom: 4, fontSize: 11, wordBreak: 'break-word' }}>
                                {String(diff.old || '').trim() || '(ריק)'}
                              </div>
                              <div style={{ color: '#10b981', fontWeight: 600, fontSize: 11, wordBreak: 'break-word' }}>
                                → {String(diff.new || '').trim() || '(ריק)'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
            
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => {
                  setShowDuplicateDialog(false);
                  setDuplicateGuests([]);
                  setGuestsToUpdate([]);
                  setPendingImportData(null);
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
                disabled={uploading}
              >
                ביטול
              </button>
              <button
                onClick={handleUpdateGuests}
                disabled={uploading || guestsToUpdate.length === 0}
                className="tropical-button-primary"
                style={{
                  padding: '10px 20px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  opacity: (uploading || guestsToUpdate.length === 0) ? 0.5 : 1,
                  cursor: (uploading || guestsToUpdate.length === 0) ? 'not-allowed' : 'pointer'
                }}
              >
                {uploading ? 'מעדכן...' : `אשר ועדכן (${guestsToUpdate.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#222' }}>
          רשימת מוזמנים
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* העלאת אקסל - נתיב חדש מבוסס Job */}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleImportUpload(file);
              }
            }}
            disabled={isViewer || uploading}
            style={{ padding: 6, fontSize: 12 }}
          />
          <span style={{ color: '#64748b', fontSize: 11 }}>
            ייבוא חדש רץ ברקע (Job). מקבלים מזהה וסטטוס, ללא תקיעות בממשק.
          </span>
          {Array.isArray(importInfos) && importInfos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 6, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
              {importInfos.map((info, idx) => (
                <div key={`${info.filename}-${info.uploadedAt}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#0f172a', fontWeight: 600, fontSize: 11 }}>קובץ נטען:</span>
                  <span style={{ color: '#334155', fontSize: 11 }}>{info.filename}</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>({(info.ids||[]).length} רשומות)</span>
                  <button
                    disabled={isViewer || uploading}
                    onClick={() => handleRemoveImport(idx)}
                    className="tropical-button-primary"
                    style={{ marginInlineStart: 6, background: 'var(--color-error, #ef4444)', fontSize: 11, padding: '4px 8px' }}
                  >
                    הסר ייבוא
                  </button>
                </div>
              ))}
            </div>
          )}
          {importJobStatus && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 6, padding: 8, minWidth: 240 }}>
              <div style={{ fontWeight: 700, color: '#c2410c', fontSize: 12 }}>סטטוס ייבוא (Job #{importJobStatus.id})</div>
              <div style={{ fontSize: 12, color: '#7c2d12' }}>
                מצב: {importJobStatus.status} | {importJobStatus.processed_rows}/{importJobStatus.total_rows} שורות
              </div>
              <div style={{ fontSize: 12, color: '#7c2d12' }}>
                הצליחו: {importJobStatus.success_count} | שגיאות: {importJobStatus.error_count}
              </div>
              {importJobStatus.error_log_path && (
                <a
                  href={`http://localhost:8001/${importJobStatus.error_log_path}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: '#b91c1c', textDecoration: 'underline' }}
                >
                  הורד קובץ שגיאות
                </a>
              )}
            </div>
          )}
          <input
            list="export-presets"
            value={{
              all: 'כל המוזמנים',
              confirmed: 'מאושרי הגעה בלבד',
              male: 'גברים בלבד',
              female: 'נשים בלבד',
              female_confirmed: 'נשים מאושרות הגעה',
              male_confirmed: 'גברים מאושרי הגעה'
            }[exportPreset]}
            onChange={(e) => {
              const label = e.target.value.trim();
              const mapping = {
                'כל המוזמנים': 'all',
                'מאושרי הגעה בלבד': 'confirmed',
                'גברים בלבד': 'male',
                'נשים בלבד': 'female',
                'נשים מאושרות הגעה': 'female_confirmed',
                'גברים מאושרי הגעה': 'male_confirmed',
              };
              const key = mapping[label] || 'all';
              setExportPreset(key);
            }}
            placeholder="בחר תצורת ייצוא..."
            style={{
              minWidth: 180,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              background: '#fff',
              fontSize: 12
            }}
          />
          <datalist id="export-presets">
            <option value="כל המוזמנים" />
            <option value="מאושרי הגעה בלבד" />
            <option value="גברים בלבד" />
            <option value="נשים בלבד" />
            <option value="נשים מאושרות הגעה" />
            <option value="גברים מאושרי הגעה" />
          </datalist>

          <button
            onClick={exportToExcel}
            className="tropical-button-primary"
            style={{
              fontSize: 12,
              padding: '6px 12px',
            }}
          >
            📤 ייצוא לאקסל
          </button>
        </div>
      </div>

      {/* פילטרים - חיפוש לפי שדה נבחר */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: 10,
        background: '#fff',
        borderRadius: 6,
        padding: 12,
        border: '1px solid #e2e8f0',
        alignItems: 'flex-end'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
          <label style={{ fontWeight: 600, marginBottom: 6, color: '#1e293b', fontSize: 12 }}>
            חפש לפי:
          </label>
          <select
            value={selectedFilterField}
            onChange={(e) => {
              setSelectedFilterField(e.target.value);
              setSearchValue(''); // נקה את החיפוש כשמשנים שדה
            }}
            className="tropical-input"
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: 13,
              borderRadius: 4,
              border: '1px solid #cbd5e1',
            }}
          >
            {filterFields.map((field) => {
          const label = FIELD_LABELS[field] || field;
            return (
                <option key={field} value={field}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 300 }}>
          <label style={{ fontWeight: 600, marginBottom: 6, color: '#1e293b', fontSize: 12 }}>
            {selectedFilterField === "confirmed_arrival" ? "סטטוס אישור הגעה:" : "ערך חיפוש:"}
          </label>
          {selectedFilterField === "confirmed_arrival" ? (
                <select
              value={searchValue}
              onChange={(e) => {
                const value = e.target.value;
                // עבור סטטוס אישור הגעה לא נדרש debounce – נעדכן מיידית את שני הסטייטים
                setSearchValue(value);
                setDebouncedSearchValue(value);
              }}
                  className="tropical-input"
                  style={{
                    width: '100%',
                padding: '8px 10px',
                fontSize: 13,
                borderRadius: 4,
                border: '1px solid #cbd5e1',
                  }}
                >
                  <option value="">כל האורחים</option>
              <option value="confirmed">אישרו הגעה</option>
              <option value="unconfirmed">לא אישרו הגעה</option>
                </select>
          ) : (
              <input
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              placeholder={`הקלד כדי לחפש ב-${FIELD_LABELS[selectedFilterField] || selectedFilterField}...`}
                className="tropical-input"
                style={{
                  width: '100%',
                padding: '8px 10px',
                fontSize: 13,
                borderRadius: 4,
                border: '1px solid #cbd5e1',
              }}
            />
          )}
            </div>
        
        {(searchValue || debouncedSearchValue) && (
          <button
          onClick={() => {
          setSearchValue('');
          setDebouncedSearchValue('');
          // איפוס לשדה ברירת המחדל התקין
          setSelectedFilterField('שם פרטי');
          if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          }
          }}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: '#f1f5f9',
              color: '#475569',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            onMouseOver={(e) => e.target.style.background = '#e2e8f0'}
            onMouseOut={(e) => e.target.style.background = '#f1f5f9'}
          >
            נקה חיפוש
          </button>
        )}
      </div>

      {/* הודעה כשאין מוזמנים - אבל ה-UI עם העלאת קובץ כבר הוצג למעלה */}
      {guests.length === 0 && !showDuplicateDialog && (
        <div style={{ 
          textAlign: 'center', 
          padding: '48px 0', 
          color: '#64748b',
          background: '#f8fafc',
          borderRadius: 8,
          margin: '12px 0',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#475569' }}>
            לא נמצאו מוזמנים
          </div>
          <div style={{ fontSize: 14, color: '#64748b' }}>
            העלה קובץ Excel/CSV כדי לייבא מוזמנים
          </div>
        </div>
      )}

      {/* מידע פגינציה */}
      {deferredFilteredGuests.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 16px', 
          background: '#f8fafc', 
          borderRadius: 8, 
          margin: '12px auto',
          maxWidth: '1200px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>
            מציג {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, deferredFilteredGuests.length)} מתוך {deferredFilteredGuests.length} מוזמנים
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  borderRadius: 4,
                  border: '1px solid #cbd5e1',
                  background: currentPage === 1 ? '#f1f5f9' : '#fff',
                  color: currentPage === 1 ? '#94a3b8' : '#475569',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 500
                }}
              >
                ← קודם
              </button>
              <div style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
                עמוד {currentPage} מתוך {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '6px 12px',
                  fontSize: 13,
                  borderRadius: 4,
                  border: '1px solid #cbd5e1',
                  background: currentPage === totalPages ? '#f1f5f9' : '#fff',
                  color: currentPage === totalPages ? '#94a3b8' : '#475569',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontWeight: 500
                }}
              >
                הבא →
              </button>
            </div>
          )}
        </div>
      )}

      {/* טבלת מוזמנים */}
      {deferredFilteredGuests.length > 0 && (
        <p style={{ margin: '6px 0 10px', fontSize: 12, color: '#475569', textAlign: 'center' }}>
          מציג {Math.min(MAX_RENDER_ROWS, paginatedGuests.length)} מתוך {deferredFilteredGuests.length} מוזמנים. לסינון/חיפוש השתמש בשדה החיפוש.
        </p>
      )}
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: '#f8fafc' }}>
                {fields.map((field, i) => (
                  <th key={`header-${field}-${i}`} style={{ 
                    padding: '8px 6px', 
                    fontWeight: 700, 
                    borderBottom: '3px solid #94a3b8',
                    borderRight: '1px solid #e2e8f0',
                    textAlign: 'right', 
                    color: '#0f172a', 
                    fontSize: 13, 
                    whiteSpace: 'nowrap',
                    background: '#f8fafc',
                    width: field === 'תעודת זהות' ? 120 : 
                           (field === 'אימייל' ? 160 : 
                           (field === 'טלפון' ? 130 : 
                           (field === 'שם משפחה' ? 140 : 
                           (field === 'כתובת' ? 180 : 
                           (field === 'מקור הפניה' ? 150 :
                           (field === 'מספר וואטסאפ' ? 130 :
                           (field === 'שם' ? 120 : 
                           (field === 'gender' ? 85 : 
                           (field === 'id' ? 60 :
                           (field === 'קבוצה' ? 220 : 'auto'))))))))))
                  }}>
                    {field}
                  </th>
                ))}
                <th style={{ padding: '8px 6px', fontWeight: 700, borderBottom: '3px solid #94a3b8', borderRight: '1px solid #e2e8f0', textAlign: 'right', color: '#0f172a', fontSize: 13, width: 140, background: '#f8fafc' }}>
                  ראש שולחן
                </th>
                <th style={{ padding: '8px 6px', fontWeight: 700, borderBottom: '3px solid #94a3b8', borderRight: '1px solid #e2e8f0', textAlign: 'center', color: '#0f172a', width: 50, fontSize: 13, background: '#f8fafc' }}>
                  אישור הגעה
                </th>
                <th style={{ padding: '8px 6px', fontWeight: 700, borderBottom: '3px solid #94a3b8', textAlign: 'center', color: '#0f172a', fontSize: 13, width: 60, background: '#f8fafc' }}>
                  פעולות
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows}
            </tbody>
          </table>
        </div>
      </div>

      {/* פקדי ניווט בתחתית */}
      {deferredFilteredGuests.length > 0 && totalPages > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: 8,
          padding: '16px', 
          background: '#f8fafc', 
          borderRadius: 8, 
          margin: '12px auto',
          maxWidth: '1200px',
          border: '1px solid #e2e8f0'
        }}>
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: currentPage === 1 ? '#f1f5f9' : '#fff',
              color: currentPage === 1 ? '#94a3b8' : '#475569',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            ראשון
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: currentPage === 1 ? '#f1f5f9' : '#fff',
              color: currentPage === 1 ? '#94a3b8' : '#475569',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            ← קודם
          </button>
          <div style={{ fontSize: 13, color: '#475569', fontWeight: 500, padding: '0 16px' }}>
            עמוד {currentPage} מתוך {totalPages}
          </div>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: currentPage === totalPages ? '#f1f5f9' : '#fff',
              color: currentPage === totalPages ? '#94a3b8' : '#475569',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            הבא →
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            style={{
              padding: '6px 12px',
              fontSize: 13,
              borderRadius: 4,
              border: '1px solid #cbd5e1',
              background: currentPage === totalPages ? '#f1f5f9' : '#fff',
              color: currentPage === totalPages ? '#94a3b8' : '#475569',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            אחרון
          </button>
        </div>
      )}
    </div>
    
  );
} 