import React, { useMemo, useState } from "react";
import "../../styles/theme-tropical.css";

const PHONE_CODES = [
  { value: "+972", label: "ישראל +972" },
  { value: "+1", label: "ארה\"ב/קנדה +1" },
  { value: "+44", label: "בריטניה +44" },
  { value: "+49", label: "גרמניה +49" },
  { value: "+33", label: "צרפת +33" },
  { value: "+34", label: "ספרד +34" },
  { value: "+39", label: "איטליה +39" },
  { value: "+31", label: "הולנד +31" },
  { value: "+7", label: "רוסיה +7" },
  { value: "+380", label: "אוקראינה +380" },
  { value: "+91", label: "הודו +91" },
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

const baseInputStyle = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "#fff",
};

export default function WomenSeatingPublicForm({ token, apiBase, formMeta, onSuccess, onError }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dialCode, setDialCode] = useState(PHONE_CODES[0].value);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [spouseName, setSpouseName] = useState("");
  const [participationWomen, setParticipationWomen] = useState("");
  const [participationMen, setParticipationMen] = useState("");
  const [customValues, setCustomValues] = useState(() => {
    const map = {};
    (formMeta?.custom_fields || []).forEach((field) => {
      map[field.id] = "";
    });
    return map;
  });
  const [status, setStatus] = useState({ submitting: false, success: false, error: null });

  const isEmailValid = useMemo(
    () => (val) => /^(?!.*\.{2})[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test((val || "").trim()),
    []
  );

  // Israeli phone validation
  const isPhoneValid = (phoneNum, code) => {
    const cleaned = String(phoneNum || '').replace(/[\s\-()]/g, '');
    if (!cleaned) return false;
    // For Israeli numbers (+972), validate format
    if (code === '+972') {
      return /^(5\d{8}|[23489]\d{7}|0?5\d{8}|0?[23489]\d{7})$/.test(cleaned);
    }
    // For other countries, just check minimum length
    return cleaned.length >= 7;
  };

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState({});

  // Real-time field validation on blur
  const validateField = (fieldName, value) => {
    let error = null;
    switch (fieldName) {
      case 'phone':
        if (value.trim() && !isPhoneValid(value, dialCode)) {
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

  const validate = () => {
    if (!firstName.trim()) return "יש להזין שם פרטי";
    if (!lastName.trim()) return "יש להזין שם משפחה";
    if (!phone.trim()) return "יש להזין מספר נייד";
    if (!isPhoneValid(phone, dialCode)) return "מספר הטלפון אינו תקין";
    if (!spouseName.trim()) return "יש להזין שם בת זוג";
    if (!participationWomen) return "יש לבחור השתתפות נשים";
    if (!participationMen) return "יש לבחור השתתפות גברים";
    if (email.trim() && !isEmailValid(email)) return "האימייל שהוזן אינו תקין";

    const missingRequiredCustom = (formMeta?.custom_fields || []).some(
      (field) => field.required && !String(customValues[field.id] || "").trim()
    );
    if (missingRequiredCustom) return "יש למלא את כל השדות הנוספים החובה";
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (status.submitting) return;

    const validationError = validate();
    if (validationError) {
      setStatus({ submitting: false, success: false, error: validationError });
      if (onError) onError(validationError);
      return;
    }

    const genderValue = participationMen === "השתתפות יחיד" ? "female" : "male";

    const payload = {
      base: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        id_number: "",
        phone: `${dialCode} ${phone}`.trim(),
        email: email.trim() || null,
        gender: genderValue,
        referral_source: "women_seating_update_public",
        spouse_name: spouseName.trim(),
        participation_women: participationWomen,
        participation_men: participationMen,
        dial_code: dialCode,
      },
      custom: Object.entries(customValues).map(([fieldId, value]) => ({
        field_id: Number(fieldId),
        value: value ?? "",
      })),
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
      setStatus({ submitting: false, success: true, error: null });
      if (onSuccess) onSuccess();
      resetForm();
    } catch (error) {
      const message = error.message || "שליחה נכשלה";
      setStatus({ submitting: false, success: false, error: message });
      if (onError) onError(message);
    }
  };

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setDialCode(PHONE_CODES[0].value);
    setPhone("");
    setEmail("");
    setSpouseName("");
    setParticipationWomen("");
    setParticipationMen("");
    setCustomValues(() => {
      const map = {};
      (formMeta?.custom_fields || []).forEach((field) => {
        map[field.id] = "";
      });
      return map;
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 24 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 34, margin: 0, color: "#0f172a" }}>ברוכים הבאים! נודה על עזרתכם במילוי השאלון לגבי הושבה</h1>
        <p style={{ fontSize: 20, marginTop: 8, color: "#334155" }}>כדי שנוכל לכבדכם כיאות</p>
      </div>

      {status.error && (
        <div style={{ background: "#fee2e2", borderRadius: 12, padding: 12, color: "#b91c1c", textAlign: "center", fontWeight: 600 }}>
          {status.error}
        </div>
      )}
      {status.success && (
        <div style={{ background: "#dcfce7", borderRadius: 12, padding: 12, color: "#15803d", textAlign: "center", fontWeight: 600 }}>
          הטופס נשלח בהצלחה! תודה שעזרתם לנו להיערך.
        </div>
      )}

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <input
            placeholder="שם פרטי *"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={baseInputStyle}
          />
          <input
            placeholder="שם משפחה *"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={baseInputStyle}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
              <select value={dialCode} onChange={(e) => setDialCode(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
                {PHONE_CODES.map((code) => (
                  <option key={code.value} value={code.value}>
                    {code.label}
                  </option>
                ))}
              </select>
              <input
                placeholder="מספר נייד *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => validateField('phone', phone)}
                style={{ ...baseInputStyle, ...(validationErrors.phone ? { border: "2px solid #ef4444" } : {}) }}
              />
            </div>
            {validationErrors.phone && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.phone}</span>}
          </div>
        </div>
      </section>

      <section>
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
            <option value="">השתתפות גברים דינר פ"נ *</option>
            {PARTICIPATION_MEN.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <input
            placeholder="שם בן/בת הזוג *"
            value={spouseName}
            onChange={(e) => setSpouseName(e.target.value)}
            style={baseInputStyle}
          />
        </div>
      </section>

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <input
              placeholder="מייל"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => validateField('email', email)}
              style={{
                ...baseInputStyle,
                ...(validationErrors.email ? { border: "2px solid #ef4444" } : {}),
              }}
            />
            {validationErrors.email && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.email}</span>}
          </div>
        </div>
      </section>

      {formMeta?.custom_fields?.length ? (
        <section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {formMeta.custom_fields.map((field) => {
              const value = customValues[field.id] ?? "";
              if (field.field_type === "select") {
                return (
                  <div key={field.id} style={{ display: "grid", gap: 6 }}>
                    <label style={{ fontWeight: 600 }}>
                      {field.label}
                      {field.required && <span style={{ color: "#ef4444" }}> *</span>}
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
                  <label style={{ fontWeight: 600 }}>
                    {field.label}
                    {field.required && <span style={{ color: "#ef4444" }}> *</span>}
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
        </section>
      ) : null}

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          type="submit"
          disabled={status.submitting}
          className="tropical-button-primary"
          style={{
            minWidth: 220,
            cursor: status.submitting ? "wait" : "pointer",
          }}
        >
          {status.submitting ? "שולח..." : "שליחה"}
        </button>
      </div>
    </form>
  );
}
