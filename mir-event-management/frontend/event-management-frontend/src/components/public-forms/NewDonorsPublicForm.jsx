import React, { useMemo, useState, useEffect } from "react";
import NedarimPlusIframe from "../NedarimPlusIframe.jsx";
import "../../styles/theme-tropical.css";

const MONTH_OPTIONS = [12, 18, 24, 36];
// Includes ₪1 test option for quick manual verification
const PRESET_DONATIONS = [
  { title: "בדיקה ₪1", amount: 1, per: "חד פעמי" },
  { title: "ידיד", amount: 250, per: "לחודש × 24" },
  { title: "מחזיק", amount: 360, per: "לחודש × 24" },
  { title: "תומך", amount: 500, per: "לחודש" },
  { title: "נועם נשאול", amount: 720, per: "לחודש" },
  { title: "שותף", amount: 1000, per: "לחודש" },
  { title: "זכות התורה אברך", amount: 1500, per: "לחודש" },
  { title: "זכות התורה חברותא", amount: 3000, per: "לחודש" },
  { title: "אוהב תורה", amount: 3600, per: "לחודש" },
  { title: "פרנס חברות י\"ח עשרה ת\"ח", amount: 18000 },
  { title: "פרנס חברות י\"ח ת\"ח", amount: 25000 },
  { title: "פרנס ההסעות ליום", amount: 36000 },
  { title: "זכות בית המדרש", amount: 100000 },
];

const PARTICIPATION_WOMEN = [
  "השתתפות יחידה נשים",
  "לא משתתפת אחר",
  "לא משתתפת חו\"ל",
  "לא משתתפת עם משפחתית",
  "ספק",
];

const PARTICIPATION_MEN = [
  "השתתפות יחיד",
  "לא משתתף אחר",
  "לא משתתף חו\"ל",
  "לא משתתף עם משפחתית",
  "ספק",
];

const GENDERS = [
  { value: "", label: "בחר" },
  { value: "male", label: "זכר" },
  { value: "female", label: "נקבה" },
];

const EXTRA_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6];

const baseInputStyle = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "#fff",
};

const compactInputStyle = {
  ...baseInputStyle,
  padding: 10,
  borderRadius: 12,
  fontSize: 14,
};

function buildEmptyExtraGuest() {
  return {
    firstName: "",
    lastName: "",
    idNumber: "",
    gender: "",
    seatNear: "",
  };
}

export default function NewDonorsPublicForm({ token, apiBase, formMeta, onSuccess, onError }) {
  const [step, setStep] = useState(1);
  const [donationAmount, setDonationAmount] = useState(0);
  const [isRecurring, setIsRecurring] = useState(false);
  const [months, setMonths] = useState(24);
  const [currency, setCurrency] = useState("ILS");

  const [details, setDetails] = useState({
    firstName: "",
    lastName: "",
    idNumber: "",
    phone: "",
    email: "",
    gender: "",
    referral: "",
    city: "",
    street: "",
    apt: "",
    spouseName: "",
    neighborhood: "",
    buildingNumber: "",
    occupation: "",
    donationAbility: "",
    enteredBy: "",
    seatNearMain: "",
    remarks: "",
  });
  const [guestId, setGuestId] = useState(null);
  const [participationWomen, setParticipationWomen] = useState("");
  const [participationMen, setParticipationMen] = useState("");
  const [greetingOption, setGreetingOption] = useState("");
  const [greetingSigner, setGreetingSigner] = useState("");
  const [greetingContent, setGreetingContent] = useState("");
  const [previousGreetingMeta, setPreviousGreetingMeta] = useState(null);
  const [previousGreetingError, setPreviousGreetingError] = useState(null);
  const [previousGreetingLoading, setPreviousGreetingLoading] = useState(false);

  const [extraCount, setExtraCount] = useState("0");
  const [extraGuests, setExtraGuests] = useState([]);

  const [customValues, setCustomValues] = useState(() => {
    const map = {};
    (formMeta?.custom_fields || []).forEach((field) => {
      map[field.id] = "";
    });
    return map;
  });

  const [status, setStatus] = useState({ submitting: false, success: false, error: null });
  const [nedarimConfig, setNedarimConfig] = useState(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  const isEmailValid = useMemo(
    () => (val) => /^(?!.*\.{2})[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test((val || "").trim()),
    []
  );

  // Israeli ID validation using Luhn algorithm
  const isIsraeliIdValid = (id) => {
    const trimmed = String(id || '').trim();
    if (!/^\d{5,9}$/.test(trimmed)) return false;
    const paddedId = trimmed.padStart(9, '0');
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let digit = parseInt(paddedId[i], 10) * ((i % 2) + 1);
      if (digit > 9) digit -= 9;
      sum += digit;
    }
    return sum % 10 === 0;
  };

  // Israeli phone validation
  const isPhoneValid = (phoneNum) => {
    const cleaned = String(phoneNum || '').replace(/[\s\-()]/g, '');
    if (cleaned.length < 9 || cleaned.length > 13) return false;
    return /^(0[23489]\d{7}|0?5\d{8}|(\+972|972)[235789]\d{7,8})$/.test(cleaned);
  };

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState({});

  // Real-time field validation on blur
  const validateField = (fieldName, value) => {
    let error = null;
    switch (fieldName) {
      case 'idNumber':
        if (value.trim() && !isIsraeliIdValid(value)) {
          error = 'תעודת זהות לא תקינה';
        }
        break;
      case 'phone':
        if (value.trim() && !isPhoneValid(value)) {
          error = 'מספר הטלפון אינו תקין';
        }
        break;
      case 'email':
        if (value.trim() && !isEmailValid(value)) {
          error = 'כתובת האימייל אינה תקינה';
        }
        break;
      default:
        break;
    }
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      if (error) newErrors[fieldName] = error;
      else delete newErrors[fieldName];
      return newErrors;
    });
    return error;
  };

  const handleSelectPreset = (amount) => {
    setDonationAmount(amount);
    if (!isRecurring) {
      setIsRecurring(true);
    }
  };

  const handleExtraCountChange = (value) => {
    setExtraCount(value);
    const parsed = Number(value) || 0;
    setExtraGuests((prev) => {
      const copy = [...prev];
      if (parsed > copy.length) {
        while (copy.length < parsed) copy.push(buildEmptyExtraGuest());
      } else if (parsed < copy.length) {
        copy.length = parsed;
      }
      return copy;
    });
  };

  const handleExtraGuestChange = (index, patch) => {
    setExtraGuests((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  useEffect(() => {
    let cancelled = false;

    const fetchPreviousGreeting = async () => {
      const trimmedId = (details.idNumber || "").trim();
      if (!trimmedId) {
        setPreviousGreetingError("יש להזין תעודת זהות לפני שימוש בברכה קודמת");
        setGreetingOption("");
        return;
      }

      setPreviousGreetingLoading(true);
      setPreviousGreetingError(null);
      setPreviousGreetingMeta(null);

      try {
        const response = await fetch(
          `${apiBase}/public/forms/${token}/previous-greeting?id_number=${encodeURIComponent(trimmedId)}`
        );

        if (cancelled) return;

        if (!response.ok) {
          if (response.status === 404) {
            setPreviousGreetingError("לא נמצאה ברכה מדינר קודם");
            setGreetingSigner("");
            setGreetingContent("");
            return;
          }
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || "לא ניתן לטעון ברכה קודמת");
        }

        const data = await response.json();
        setGreetingSigner(data.signer_name || "");
        setGreetingContent(data.content || "");
        setPreviousGreetingMeta({
          eventName: data.event_name || "",
          eventDate: data.event_date || null,
        });
      } catch (error) {
        if (cancelled) return;
        setPreviousGreetingError(error.message || "לא ניתן לטעון ברכה קודמת");
        setGreetingSigner("");
        setGreetingContent("");
      } finally {
        if (!cancelled) {
          setPreviousGreetingLoading(false);
        }
      }
    };

    if (greetingOption === "reuse_previous") {
      fetchPreviousGreeting();
    } else {
      setPreviousGreetingMeta(null);
      setPreviousGreetingError(null);
      setPreviousGreetingLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [greetingOption, details.idNumber, apiBase, token]);

  const requiredErrors = () => {
    const errors = [];
    if (!details.firstName.trim()) errors.push("יש להזין שם פרטי");
    if (!details.lastName.trim()) errors.push("יש להזין שם משפחה");
    if (!details.phone.trim()) {
      errors.push("יש להזין טלפון");
    } else if (!isPhoneValid(details.phone)) {
      errors.push("מספר הטלפון אינו תקין");
    }
    if (!details.idNumber.trim()) {
      errors.push("יש להזין תעודת זהות");
    } else if (!isIsraeliIdValid(details.idNumber)) {
      errors.push("מספר הזהות אינו תקין");
    }
    if (!details.gender) errors.push("יש לבחור מגדר");
    if (details.email.trim() && !isEmailValid(details.email)) errors.push("האימייל אינו תקין");
    if (!participationWomen) errors.push("יש לבחור השתתפות נשים");
    if (!participationMen) errors.push("יש לבחור השתתפות גברים");
    const customMissing = (formMeta?.custom_fields || []).filter((field) => field.required && !String(customValues[field.id] || "").trim());
    if (customMissing.length > 0) errors.push("יש למלא את כל השדות הנוספים החובה");
    return errors;
  };

  const resetForm = () => {
    setStep(1);
    setDonationAmount(0);
    setIsRecurring(false);
    setMonths(24);
    setCurrency("ILS");
    setDetails({ firstName: "", lastName: "", idNumber: "", phone: "", email: "", gender: "", referral: "", city: "", street: "", apt: "", spouseName: "", neighborhood: "", buildingNumber: "", occupation: "", donationAbility: "", enteredBy: "", seatNearMain: "", remarks: "" });
    setParticipationWomen("");
    setParticipationMen("");
    setGreetingOption("");
    setGreetingSigner("");
    setGreetingContent("");
    setPreviousGreetingMeta(null);
    setPreviousGreetingError(null);
    setPreviousGreetingLoading(false);
    setExtraCount("0");
    setExtraGuests([]);
    setCustomValues(() => {
      const map = {};
      (formMeta?.custom_fields || []).forEach((field) => {
        map[field.id] = "";
      });
      return map;
    });
    setGuestId(null);
    setNedarimConfig(null);
    setPaymentCompleted(false);
    setPaymentError(null);
    setStatus({ submitting: false, success: false, error: null });
  };

  const handleSubmit = async () => {
    const errors = requiredErrors();
    if (errors.length > 0) {
      setStatus({ submitting: false, success: false, error: errors[0] });
      return;
    }

    const payload = {
      base: {
        first_name: details.firstName.trim(),
        last_name: details.lastName.trim(),
        id_number: details.idNumber.trim(),
        phone: details.phone.trim(),
        email: details.email.trim() || null,
        gender: details.gender,
        referral_source: details.referral.trim() || null,
        city: details.city.trim() || null,
        street: details.street.trim() || null,
        apartment: details.apt.trim() || null,
        building_number: details.buildingNumber.trim() || null,
        neighborhood: details.neighborhood.trim() || null,
        spouse_name: details.spouseName.trim() || null,
        occupation: details.occupation.trim() || null,
        donation_ability: details.donationAbility.trim() || null,
        entered_by: details.enteredBy.trim() || null,
        seat_near_main: details.seatNearMain.trim() || null,
        remarks: details.remarks.trim() || null,
        donation_amount: donationAmount,
        donation_currency: currency,
        donation_is_recurring: isRecurring,
        donation_months: months,
        greeting_option: greetingOption,
        greeting_signer:
          greetingOption === "now" || greetingOption === "reuse_previous" ? greetingSigner.trim() || null : null,
        greeting_content:
          greetingOption === "now" || greetingOption === "reuse_previous" ? greetingContent.trim() || null : null,
        participation_women: participationWomen,
        participation_men: participationMen,
      },
      custom: Object.entries(customValues).map(([fieldId, value]) => ({
        field_id: Number(fieldId),
        value: value ?? "",
      })),
      extra: {
        extra_guests_count: extraCount,
        extra_guests: extraGuests.map((guest) => ({
          first_name: guest.firstName,
          last_name: guest.lastName,
          id_number: guest.idNumber,
          gender: guest.gender,
          seat_near: guest.seatNear,
        })),
      },
    };

    try {
      setStatus({ submitting: true, success: false, error: null });
      const res = await fetch(`${apiBase}/public/forms/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "שליחה נכשלה");
      }
      const data = await res.json();
      setGuestId(data?.guest_id || null);
      setStatus({ submitting: false, success: false, error: null });
      setPaymentCompleted(false);
      setPaymentError(null);
      setStep(3);
    } catch (error) {
      const message = error.message || "שליחה נכשלה";
      setStatus({ submitting: false, success: false, error: message });
      if (onError) onError(message);
    }
  };

  const fetchNedarimConfig = async () => {
    try {
      const res = await fetch(`${apiBase}/public/forms/${token}/payments/config`);
      if (!res.ok) {
        throw new Error("טעינת הגדרות התשלום נכשלה");
      }
      const data = await res.json();
      setNedarimConfig(data);
    } catch (err) {
      setPaymentError(err.message);
    }
  };

  useEffect(() => {
    if (step === 3 && !nedarimConfig) {
      fetchNedarimConfig();
    }
  }, [step, nedarimConfig]);

  const handlePublicPaymentComplete = async (transactionData) => {
    setPaymentCompleted(true);
    setPaymentError(null);
    try {
      await fetch(`${apiBase}/public/forms/${token}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: formMeta?.event_id,
          guest_id: guestId,
          amount: donationAmount,
          payment_type: isRecurring ? "HK" : "Ragil",
          currency: currency === "ILS" ? "1" : "2",
          tashloumim: isRecurring ? months : 1,
          client_name: `${details.firstName} ${details.lastName}`.trim(),
          zeout: details.idNumber,
          phone: details.phone,
          mail: details.email,
          address: `${details.street || ""} ${details.apt || ""} ${details.city || ""}`.trim(),
          groupe: "תורמים חדשים",
          comments: `תרומה דרך טופס ציבורי - ${isRecurring ? "הוראת קבע" : "תשלום חד פעמי"}`,
          param1: `event_${formMeta?.event_id}`,
          param2: guestId ? `guest_${guestId}` : undefined,
        }),
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Error saving payment", err);
    }
  };

  const handlePublicPaymentError = (errorData) => {
    setPaymentError(errorData?.Message || "התשלום נכשל. נסו שוב מאוחר יותר.");
  };

  const renderDonationTiles = () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
        marginTop: 16,
      }}
    >
      {PRESET_DONATIONS.map((tile, index) => {
        const selected = donationAmount === tile.amount;
        return (
          <button
            key={index}
            type="button"
            onClick={() => handleSelectPreset(tile.amount)}
            style={{
              textAlign: "center",
              background: selected ? "linear-gradient(180deg,#eef2ff,#ffffff)" : "#fff",
              borderRadius: 16,
              border: selected ? "2px solid #6366f1" : "1px solid #e2e8f0",
              padding: 20,
              minHeight: 140,
              boxShadow: selected ? "0 10px 22px rgba(99,102,241,0.25)" : "0 4px 12px rgba(0,0,0,0.05)",
              cursor: "pointer",
            }}
          >
            <div style={{ color: "#475569", marginBottom: 8, fontWeight: 800 }}>{tile.title}</div>
            <div style={{ fontSize: 32, fontWeight: 900 }}>₪{tile.amount.toLocaleString()}</div>
            {tile.per && <div style={{ color: "#64748b", marginTop: 6 }}>{tile.per}</div>}
          </button>
        );
      })}
    </div>
  );

  const renderStepOne = () => (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{ ...baseInputStyle, width: 140 }}>
            <option value="ILS">₪ ILS</option>
          </select>
          <input
            type="number"
            min={0}
            value={donationAmount || ""}
            onChange={(e) => setDonationAmount(Number(e.target.value) || 0)}
            placeholder="הזנת סכום חופשי"
            style={{ ...baseInputStyle, width: 180, fontWeight: 800, textAlign: "left" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
            הוראת קבע בסכום זה למשך
          </label>
          <select
            disabled={!isRecurring}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            style={{ ...baseInputStyle, minWidth: 70 }}
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span>חודשים</span>
        </div>
      </div>
      {renderDonationTiles()}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={donationAmount <= 0}
          className="tropical-button-primary"
          style={{
            minWidth: 160,
          }}
        >
          לשלב הבא
        </button>
      </div>
    </div>
  );

  const renderCustomFields = () => {
    if (!formMeta?.custom_fields?.length) return null;
    return (
      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 12 }}>שדות נוספים</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {formMeta.custom_fields.map((field) => {
            const value = customValues[field.id] ?? "";
            const isRequired = field.required;

            if (field.field_type === "select") {
              return (
                <div key={field.id} style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontWeight: 700 }}>
                    {field.label}
                    {isRequired && <span style={{ color: "#ef4444" }}> *</span>}
                  </label>
                  <select
                    value={value}
                    onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                    style={{ ...baseInputStyle, background: "#fff" }}
                  >
                    <option value="">בחר</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt.value ?? opt.label} value={opt.value ?? opt.label}>
                        {opt.label ?? opt.value}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            if (field.field_type === "checkbox") {
              return (
                <div key={field.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.id]: e.target.checked }))}
                  />
                  <span>{field.label}</span>
                </div>
              );
            }

            return (
              <div key={field.id} style={{ display: "grid", gap: 6 }}>
                <label style={{ fontWeight: 700 }}>
                  {field.label}
                  {isRequired && <span style={{ color: "#ef4444" }}> *</span>}
                </label>
                <input
                  placeholder={field.label}
                  value={value}
                  onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  style={baseInputStyle}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderExtraGuests = () => (
    <div style={{ marginTop: 16 }}>
      <select
        value={extraCount}
        onChange={(e) => handleExtraCountChange(e.target.value)}
        style={{ ...baseInputStyle, background: "#fff", width: 220 }}
      >
        <option value="" disabled>
          הבאת אורח/ת נוספ/ת *
        </option>
        {EXTRA_COUNT_OPTIONS.map((n) => (
          <option key={n} value={String(n)}>
            {n}
          </option>
        ))}
      </select>
      {extraGuests.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {extraGuests.map((guest, index) => (
            <div
              key={index}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                background: "#f8fafc",
                padding: 12,
                borderRadius: 12,
              }}
            >
              <input
                placeholder={`שם משפחה משתתף (${index + 1})`}
                value={guest.lastName}
                onChange={(e) => handleExtraGuestChange(index, { lastName: e.target.value })}
                style={baseInputStyle}
              />
              <input
                placeholder={`שם פרטי משתתף (${index + 1})`}
                value={guest.firstName}
                onChange={(e) => handleExtraGuestChange(index, { firstName: e.target.value })}
                style={baseInputStyle}
              />
              <input
                placeholder={`מספר זהות משתתף (${index + 1})`}
                value={guest.idNumber}
                onChange={(e) => handleExtraGuestChange(index, { idNumber: e.target.value })}
                style={baseInputStyle}
              />
              <select
                value={guest.gender}
                onChange={(e) => handleExtraGuestChange(index, { gender: e.target.value })}
                style={{ ...baseInputStyle, background: "#fff" }}
              >
                <option value="">מגדר משתתף ({index + 1})</option>
                <option value="זכר">זכר</option>
                <option value="נקבה">נקבה</option>
              </select>
              <input
                placeholder={`ליד מי תרצו לשבת? (משתתף ${index + 1})`}
                value={guest.seatNear}
                onChange={(e) => handleExtraGuestChange(index, { seatNear: e.target.value })}
                style={baseInputStyle}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStepTwo = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <input
          placeholder="שם פרטי"
          value={details.firstName}
          onChange={(e) => setDetails((prev) => ({ ...prev, firstName: e.target.value }))}
          style={baseInputStyle}
        />
        <input
          placeholder="שם משפחה"
          value={details.lastName}
          onChange={(e) => setDetails((prev) => ({ ...prev, lastName: e.target.value }))}
          style={baseInputStyle}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <input
            placeholder="תעודת זהות"
            value={details.idNumber}
            onChange={(e) => setDetails((prev) => ({ ...prev, idNumber: e.target.value }))}
            onBlur={() => validateField('idNumber', details.idNumber)}
            style={{ ...baseInputStyle, ...(validationErrors.idNumber ? { border: "2px solid #ef4444" } : {}) }}
          />
          {validationErrors.idNumber && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.idNumber}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <input
            placeholder="טלפון"
            value={details.phone}
            onChange={(e) => setDetails((prev) => ({ ...prev, phone: e.target.value }))}
            onBlur={() => validateField('phone', details.phone)}
            style={{ ...baseInputStyle, ...(validationErrors.phone ? { border: "2px solid #ef4444" } : {}) }}
          />
          {validationErrors.phone && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.phone}</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <input
            placeholder="אימייל"
            value={details.email}
            onChange={(e) => setDetails((prev) => ({ ...prev, email: e.target.value }))}
            onBlur={() => validateField('email', details.email)}
            style={{ ...baseInputStyle, ...(validationErrors.email ? { border: "2px solid #ef4444" } : {}) }}
          />
          {validationErrors.email && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.email}</span>}
        </div>
        <select
          value={details.gender}
          onChange={(e) => setDetails((prev) => ({ ...prev, gender: e.target.value }))}
          style={{ ...baseInputStyle, background: "#fff" }}
        >
          {GENDERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          placeholder="מי הביא אותך?"
          value={details.referral}
          onChange={(e) => setDetails((prev) => ({ ...prev, referral: e.target.value }))}
          style={baseInputStyle}
        />
        <input
          placeholder="עיר"
          value={details.city}
          onChange={(e) => setDetails((prev) => ({ ...prev, city: e.target.value }))}
          style={baseInputStyle}
        />
        <input
          placeholder="רחוב"
          value={details.street}
          onChange={(e) => setDetails((prev) => ({ ...prev, street: e.target.value }))}
          style={baseInputStyle}
        />
        <input
          placeholder="דירה"
          value={details.apt}
          onChange={(e) => setDetails((prev) => ({ ...prev, apt: e.target.value }))}
          style={baseInputStyle}
        />
        <input
          placeholder="מספר בנין"
          value={details.buildingNumber}
          onChange={(e) => setDetails((prev) => ({ ...prev, buildingNumber: e.target.value }))}
          style={baseInputStyle}
        />
        <input
          placeholder="שכונה"
          value={details.neighborhood}
          onChange={(e) => setDetails((prev) => ({ ...prev, neighborhood: e.target.value }))}
          style={baseInputStyle}
        />
        <input
          placeholder="שם בת הזוג"
          value={details.spouseName}
          onChange={(e) => setDetails((prev) => ({ ...prev, spouseName: e.target.value }))}
          style={baseInputStyle}
        />
        <input
          placeholder="עיסוק"
          value={details.occupation}
          onChange={(e) => setDetails((prev) => ({ ...prev, occupation: e.target.value }))}
          style={baseInputStyle}
        />
        <input
          placeholder="יכולת תרומה"
          value={details.donationAbility}
          onChange={(e) => setDetails((prev) => ({ ...prev, donationAbility: e.target.value }))}
          style={baseInputStyle}
        />
        <input
          placeholder='הוכנס למערכת ע"י'
          value={details.enteredBy}
          onChange={(e) => setDetails((prev) => ({ ...prev, enteredBy: e.target.value }))}
          style={baseInputStyle}
        />
        <input
          placeholder='ליד מי תרצו לשבת? (משתתף ראשי)'
          value={details.seatNearMain}
          onChange={(e) => setDetails((prev) => ({ ...prev, seatNearMain: e.target.value }))}
          style={baseInputStyle}
        />
        <textarea
          placeholder="הערות"
          value={details.remarks}
          onChange={(e) => setDetails((prev) => ({ ...prev, remarks: e.target.value }))}
          style={{ ...baseInputStyle, minHeight: 80 }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <select
          value={participationWomen}
          onChange={(e) => setParticipationWomen(e.target.value)}
          style={{ ...baseInputStyle, background: "#fff" }}
        >
          <option value="">עדכון השתתפות נשים דינר פ"נ *</option>
          {PARTICIPATION_WOMEN.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <select
          value={participationMen}
          onChange={(e) => setParticipationMen(e.target.value)}
          style={{ ...baseInputStyle, background: "#fff" }}
        >
          <option value="">עדכון השתתפות גברים דינר פ"נ *</option>
          {PARTICIPATION_MEN.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ fontWeight: 800, color: "#334155" }}>ברכה בספר הברכות</label>
        <select
          value={greetingOption}
          onChange={(e) => setGreetingOption(e.target.value)}
          style={{ ...baseInputStyle, background: "#fff", width: 240, marginTop: 8 }}
        >
          <option value="">בחר</option>
          <option value="now">הוספת פרטים עכשיו</option>
          <option value="not_needed">לא נצרך</option>
          <option value="reuse_previous">שימוש בברכה של הדינר הקודם</option>
        </select>
        {(greetingOption === "now" || greetingOption === "reuse_previous") && (
          <div style={{ marginTop: 12 }}>
            {greetingOption === "reuse_previous" && (
              <div style={{ marginBottom: 12, background: "#f1f5f9", borderRadius: 12, padding: 12, fontSize: 14, color: "#0f172a" }}>
                {previousGreetingLoading && "טוען ברכה קודמת..."}
                {!previousGreetingLoading && previousGreetingError && <span>{previousGreetingError}</span>}
                {!previousGreetingLoading && !previousGreetingError && previousGreetingMeta && (
                  <span>
                    הברכה נטענה מאירוע {previousGreetingMeta.eventName || ""}
                    {previousGreetingMeta.eventDate ? ` (${new Date(previousGreetingMeta.eventDate).toLocaleDateString()})` : ""}.
                  </span>
                )}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <input
                placeholder="שם חותם הברכה"
                value={greetingSigner}
                onChange={(e) => setGreetingSigner(e.target.value)}
                style={compactInputStyle}
              />
              <textarea
                placeholder="תוכן הברכה *"
                value={greetingContent}
                onChange={(e) => setGreetingContent(e.target.value)}
                style={{ ...compactInputStyle, minHeight: 60 }}
              />
            </div>
          </div>
        )}
      </div>

      {renderCustomFields()}
      {renderExtraGuests()}

      {status.error && (
        <div style={{ background: "#fee2e2", borderRadius: 12, padding: 12, color: "#b91c1c", textAlign: "center", fontWeight: 600 }}>
          {status.error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <button
          type="button"
          onClick={() => setStep(1)}
          style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontWeight: 700 }}
        >
          חזרה
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={status.submitting}
          className="tropical-button-primary"
          style={{
            minWidth: 160,
            cursor: status.submitting ? "wait" : "pointer",
          }}
        >
          {status.submitting ? "שולח..." : "שלח טופס"}
        </button>
      </div>

      {status.success && (
        <div style={{ background: "#dcfce7", borderRadius: 12, padding: 12, color: "#15803d", textAlign: "center", fontWeight: 600 }}>
          הטופס נשלח בהצלחה! ניצור איתך קשר בהקדם.
        </div>
      )}
    </div>
  );

  const renderPaymentStep = () => {
    const paymentData = {
      Mosad: nedarimConfig?.mosad_id,
      ApiValid: nedarimConfig?.api_valid,
      PaymentType: isRecurring ? "HK" : "Ragil",
      Currency: currency === "ILS" ? "1" : "2",
      Zeout: details.idNumber || "",
      FirstName: details.firstName || "",
      LastName: details.lastName || "",
      Street: details.street || "",
      City: details.city || "",
      Phone: details.phone || "",
      Mail: details.email || "",
      Amount: String(donationAmount),
      Tashlumim: String(isRecurring ? months : 1),
      Day: isRecurring ? "1" : "",
      Groupe: "תורמים חדשים",
      Comment: `תרומה דרך טופס ציבורי - ${isRecurring ? "הוראת קבע" : "תשלום חד פעמי"}`,
      Param1: `event_${formMeta?.event_id}`,
      Param2: guestId ? `guest_${guestId}` : "",
      CallBack: `${window.location.origin}/api/payments/webhook/nedarim-plus/regular`,
      CallBackMailError: "",
    };

    if (!nedarimConfig && !paymentError) {
      return (
        <div style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
          טוען הגדרות תשלום...
        </div>
      );
    }

    if (paymentCompleted) {
      return (
        <div style={{ marginTop: 24, background: "#f0fdf4", border: "2px solid #86efac", borderRadius: 16, padding: 40, textAlign: "center", boxShadow: "0 10px 28px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
          <h2 style={{ color: "#166534", marginBottom: 8 }}>התשלום בוצע בהצלחה!</h2>
          <p style={{ color: "#15803d", fontSize: 16 }}>
            תודה רבה על תרומתכם.
            {isRecurring && ` הוראת הקבע שלכם בסך ₪${donationAmount.toLocaleString()} לחודש × ${months} חודשים נקלטה במערכת.`}
          </p>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 16 }}>
        {paymentError && (
          <div style={{ background: "#fee2e2", borderRadius: 12, padding: 12, color: "#b91c1c", textAlign: "center", fontWeight: 600 }}>
            {paymentError}
          </div>
        )}
        {nedarimConfig && (
          <NedarimPlusIframe
            paymentData={paymentData}
            onTransactionComplete={handlePublicPaymentComplete}
            onTransactionError={handlePublicPaymentError}
            language="he"
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {step === 1 && renderStepOne()}
      {step === 2 && renderStepTwo()}
      {step === 3 && renderPaymentStep()}
    </div>
  );
}
