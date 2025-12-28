/**
 * Public VIP registration form – mirrors the internal VIP form layout
 * but submits through the public share endpoint (no authentication).
 */
import React, { useEffect, useMemo, useState } from "react";
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

const participationOptions = [
  "השתתפות יחיד",
  "לא משתתף אחר",
  "לא משתתף חו\"ל",
  "לא משתתף עם משפחתית",
  "ספק",
];

const participationWomenOptions = [
  "השתתפות יחידה נשים",
  "לא משתתפת אחר",
  "לא משתתפת חו\"ל",
  "לא משתתפת עם משפחתית",
  "ספק",
];

const donationAbilityOptions = [
  "",
  "הו\"ק גבוהה",
  "הו\"ק רגילה",
  "יכולת גבוהה",
  "לא ידוע",
  "VIP",
];

const blessingOptions = [
  "",
  "הוספת פרטים עכשיו",
  "לא נצרך",
  "שימוש בברכה של הדינר הקודם",
];

const guestGenderOptions = [
  { value: "", label: "מגדר" },
  { value: "זכר", label: "זכר" },
  { value: "נקבה", label: "נקבה" },
];

function buildEmptyExtraGuest() {
  return { firstName: "", lastName: "", idNumber: "", gender: "", seatNear: "" };
}

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

export default function VipPublicForm({ token, apiBase, formMeta, onSuccess, onError }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [spouseName, setSpouseName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [dialCode, setDialCode] = useState(PHONE_CODES[0].value);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [buildingNumber, setBuildingNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [occupation, setOccupation] = useState("");
  const [enteredBy, setEnteredBy] = useState("");
  const [donationAbility, setDonationAbility] = useState("");
  const [participationMen, setParticipationMen] = useState("");
  const [participationWomen, setParticipationWomen] = useState("");
  const [blessingOption, setBlessingOption] = useState("");
  const [blessingSigner, setBlessingSigner] = useState("");
  const [blessingContent, setBlessingContent] = useState("");
  const [blessingLogo, setBlessingLogo] = useState(null);
  const [blessingFilePath, setBlessingFilePath] = useState(null);
  const [seatNearMain, setSeatNearMain] = useState("");
  const [extraGuestsCount, setExtraGuestsCount] = useState("0");
  const [extraGuests, setExtraGuests] = useState([]);
  const [previousBlessingMeta, setPreviousBlessingMeta] = useState(null);
  const [previousBlessingError, setPreviousBlessingError] = useState(null);
  const [previousBlessingLoading, setPreviousBlessingLoading] = useState(false);

  const [status, setStatus] = useState({ submitting: false, success: false, error: null });
  const customFields = formMeta?.custom_fields || [];
  const [customValues, setCustomValues] = useState(() => {
    const map = {};
    customFields.forEach((field) => {
      map[field.id] = field.field_type === "checkbox" ? false : "";
    });
    return map;
  });

  useEffect(() => {
    setCustomValues(() => {
      const map = {};
      customFields.forEach((field) => {
        map[field.id] = field.field_type === "checkbox" ? false : "";
      });
      return map;
    });
  }, [JSON.stringify(customFields.map((f) => ({ id: f.id, required: f.required, type: f.field_type })))]);

  useEffect(() => {
    let cancelled = false;

    const fetchPreviousGreeting = async () => {
      const trimmedId = idNumber.trim();
      if (!trimmedId) {
        setPreviousBlessingError("יש להזין תעודת זהות לפני שימוש בברכה קודמת");
        setBlessingOption("");
        return;
      }

      setPreviousBlessingLoading(true);
      setPreviousBlessingError(null);
      setPreviousBlessingMeta(null);

      try {
        const response = await fetch(
          `${apiBase}/public/forms/${token}/previous-greeting?id_number=${encodeURIComponent(trimmedId)}`
        );

        if (cancelled) return;

        if (!response.ok) {
          if (response.status === 404) {
            setPreviousBlessingError("לא נמצאה ברכה מדינר קודם");
            setBlessingSigner("");
            setBlessingContent("");
            return;
          }
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || "לא ניתן לטעון ברכה קודמת");
        }

        const data = await response.json();
        setBlessingSigner(data.signer_name || "");
        setBlessingContent(data.content || "");
        setPreviousBlessingMeta({
          eventName: data.event_name || "",
          eventDate: data.event_date || null,
        });
      } catch (error) {
        if (cancelled) return;
        setPreviousBlessingError(error.message || "לא ניתן לטעון ברכה קודמת");
        setBlessingSigner("");
        setBlessingContent("");
      } finally {
        if (!cancelled) {
          setPreviousBlessingLoading(false);
        }
      }
    };

    if (blessingOption === "שימוש בברכה של הדינר הקודם") {
      fetchPreviousGreeting();
    } else {
      setPreviousBlessingMeta(null);
      setPreviousBlessingError(null);
      setPreviousBlessingLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [blessingOption, idNumber, apiBase, token]);

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
  const isPhoneValid = (phoneNum, code) => {
    const cleaned = String(phoneNum || '').replace(/[\s\-()]/g, '');
    if (!cleaned) return false;
    if (code === '+972') {
      return /^(5\d{8}|[23489]\d{7}|0?5\d{8}|0?[23489]\d{7})$/.test(cleaned);
    }
    return cleaned.length >= 7;
  };

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState({});

  // Real-time field validation on blur
  const validateField = (fieldName, value, options = {}) => {
    let error = null;
    switch (fieldName) {
      case 'idNumber':
        if (value.trim() && !isIsraeliIdValid(value)) {
          error = 'תעודת זהות לא תקינה';
        }
        break;
      case 'phone':
        if (value.trim() && !isPhoneValid(value, options.dialCode || dialCode)) {
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

  const extraCountNumber = Number(extraGuestsCount) || 0;

  const updateExtraGuestsLength = (count) => {
    setExtraGuests((prev) => {
      const clone = [...prev];
      if (count > clone.length) {
        while (clone.length < count) clone.push(buildEmptyExtraGuest());
      } else if (count < clone.length) {
        clone.length = count;
      }
      return clone;
    });
  };

  const handleExtraCountChange = (value) => {
    setExtraGuestsCount(value);
    const parsed = Number(value) || 0;
    updateExtraGuestsLength(parsed);
  };

  const setExtraGuest = (index, patch) => {
    setExtraGuests((prev) => {
      const clone = [...prev];
      clone[index] = { ...clone[index], ...patch };
      return clone;
    });
  };

  const validate = () => {
    if (!firstName.trim()) return "יש להזין שם פרטי";
    if (!lastName.trim()) return "יש להזין שם משפחה";
    if (!idNumber.trim()) return "יש להזין תעודת זהות";
    if (!isIsraeliIdValid(idNumber)) return "מספר הזהות אינו תקין";
    if (!phone.trim()) return "יש להזין מספר טלפון";
    if (!isPhoneValid(phone, dialCode)) return "מספר הטלפון אינו תקין";
    if (email.trim() && !isEmailValid(email)) return "האימייל שהוזן אינו תקין";
    if (!enteredBy.trim()) return "יש להזין מי הכניס למערכת";
    if (!participationMen) return "יש לבחור השתתפות גברים";
    if (!participationWomen) return "יש לבחור השתתפות נשים";
    const missingRequiredCustom = customFields.some((field) => {
      if (!field.required) return false;
      const value = customValues[field.id];
      if (field.field_type === "checkbox") {
        return !value;
      }
      return !String(value || "").trim();
    });
    if (missingRequiredCustom) return "יש למלא את כל השדות הנוספים החובה";
    return null;
  };

  const clearForm = () => {
    setFirstName("");
    setLastName("");
    setSpouseName("");
    setIdNumber("");
    setDialCode(PHONE_CODES[0].value);
    setPhone("");
    setEmail("");
    setCity("");
    setStreet("");
    setNeighborhood("");
    setBuildingNumber("");
    setApartment("");
    setOccupation("");
    setEnteredBy("");
    setDonationAbility("");
    setParticipationMen("");
    setParticipationWomen("");
    setBlessingOption("");
    setBlessingSigner("");
    setBlessingContent("");
    setSeatNearMain("");
    setExtraGuestsCount("0");
    setExtraGuests([]);
    setCustomValues(() => {
      const map = {};
      customFields.forEach((field) => {
        map[field.id] = field.field_type === "checkbox" ? false : "";
      });
      return map;
    });
    setPreviousBlessingMeta(null);
    setPreviousBlessingError(null);
    setPreviousBlessingLoading(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (status.submitting) return;

    const validationError = validate();
    if (validationError) {
      setStatus({ submitting: false, success: false, error: validationError });
      return;
    }

    const payload = {
      base: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        id_number: idNumber.trim(),
        phone: `${dialCode} ${phone}`.trim(),
        email: email.trim() || null,
        gender: "male",
        referral_source: "vip_registration_public",
        spouse_name: spouseName.trim() || null,
        city: city.trim() || null,
        street: street.trim() || null,
        neighborhood: neighborhood.trim() || null,
        building_number: buildingNumber.trim() || null,
        apartment: apartment.trim() || null,
        occupation: occupation.trim() || null,
        entered_by: enteredBy.trim(),
        donation_ability: donationAbility || null,
        participation_men: participationMen,
        participation_women: participationWomen,
        blessing_option: blessingOption || null,
        blessing_signer:
          blessingOption === "הוספת פרטים עכשיו" || blessingOption === "שימוש בברכה של הדינר הקודם"
            ? blessingSigner.trim() || null
            : null,
        blessing_content:
          blessingOption === "הוספת פרטים עכשיו" || blessingOption === "שימוש בברכה של הדינר הקודם"
            ? blessingContent.trim() || null
            : null,
        blessing_file_path: blessingFilePath || null,
        blessing_file_name: blessingLogo?.name || null,
        seat_near_main: seatNearMain.trim() || null,
      },
      custom: Object.entries(customValues).map(([fieldId, value]) => ({
        field_id: Number(fieldId),
        value: typeof value === "boolean" ? (value ? "true" : "") : value ?? "",
      })),
      extra: {
        extra_guests_count: extraGuestsCount,
        extra_guests: extraGuests
          .filter((g) => (g.firstName || "").trim() || (g.lastName || "").trim())
          .map((g) => ({
            first_name: (g.firstName || "").trim(),
            last_name: (g.lastName || "").trim(),
            id_number: (g.idNumber || "").trim(),
            gender: g.gender,
            seat_near: (g.seatNear || "").trim(),
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
      setStatus({ submitting: false, success: true, error: null });
      clearForm();
      if (onSuccess) onSuccess();
    } catch (error) {
      const message = error.message || "שליחה נכשלה";
      setStatus({ submitting: false, success: false, error: message });
      if (onError) onError(message);
    }
  };

  const renderCustomField = (field) => {
    const value = customValues[field.id];
    if (field.field_type === "select") {
      return (
        <select
          key={field.id}
          value={value ?? ""}
          onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
          style={{ ...baseInputStyle, background: "#fff" }}
        >
          <option value="">{field.label}{field.required ? " *" : ""}</option>
          {(field.options || []).map((opt) => (
            <option key={String(opt.value ?? opt.label)} value={opt.value ?? opt.label}>
              {opt.label ?? opt.value}
            </option>
          ))}
        </select>
      );
    }

    if (field.field_type === "checkbox") {
      return (
        <label
          key={field.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: "0 16px",
            background: "#fff",
            minHeight: 54,
          }}
        >
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.id]: e.target.checked }))}
          />
          <span>
            {field.label}
            {field.required && <span style={{ color: "#ef4444" }}> *</span>}
          </span>
        </label>
      );
    }

    return (
      <input
        key={field.id}
        placeholder={`${field.label}${field.required ? " *" : ""}`}
        value={value ?? ""}
        onChange={(e) => setCustomValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
        style={baseInputStyle}
      />
    );
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 24 }}>
      {status.error && (
        <div style={{ background: "#fee2e2", borderRadius: 14, padding: 12, color: "#b91c1c", textAlign: "center", fontWeight: 600 }}>
          {status.error}
        </div>
      )}
      {status.success && (
        <div style={{ background: "#dcfce7", borderRadius: 14, padding: 12, color: "#15803d", textAlign: "center", fontWeight: 600 }}>
          הטופס נשלח בהצלחה!
        </div>
      )}

      <section>
        <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 900, color: "#0f172a", textAlign: "center" }}>רישום VIP</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <input
            placeholder="שם פרטי (משתתף ראשי)"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={baseInputStyle}
          />
          <input
            placeholder="שם משפחה (משתתף ראשי)"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={baseInputStyle}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <input
              placeholder="תעודת זהות *"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              onBlur={() => validateField('idNumber', idNumber)}
              style={{ ...baseInputStyle, ...(validationErrors.idNumber ? { border: "2px solid #ef4444" } : {}) }}
            />
            {validationErrors.idNumber && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.idNumber}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <input
              placeholder="מייל (משתתף ראשי)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => validateField('email', email)}
              style={{ ...baseInputStyle, ...(validationErrors.email ? { border: "2px solid #ef4444" } : {}) }}
            />
            {validationErrors.email && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.email}</span>}
          </div>
          <input
            placeholder="שם בת הזוג"
            value={spouseName}
            onChange={(e) => setSpouseName(e.target.value)}
            style={baseInputStyle}
          />
        </div>
      </section>

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
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
                placeholder="מספר נייד (משתתף ראשי)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => validateField('phone', phone)}
                style={{ ...baseInputStyle, ...(validationErrors.phone ? { border: "2px solid #ef4444" } : {}) }}
              />
            </div>
            {validationErrors.phone && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{validationErrors.phone}</span>}
          </div>
          <input placeholder="עיר" value={city} onChange={(e) => setCity(e.target.value)} style={baseInputStyle} />
          <input placeholder="רחוב" value={street} onChange={(e) => setStreet(e.target.value)} style={baseInputStyle} />
          <input placeholder="שכונה" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} style={baseInputStyle} />
          <input placeholder="מספר בניין" value={buildingNumber} onChange={(e) => setBuildingNumber(e.target.value)} style={baseInputStyle} />
          <input placeholder="מספר דירה" value={apartment} onChange={(e) => setApartment(e.target.value)} style={baseInputStyle} />
          <input placeholder="עיסוק" value={occupation} onChange={(e) => setOccupation(e.target.value)} style={baseInputStyle} />
          <input
            placeholder='הוכנס למערכת ע"י *'
            value={enteredBy}
            onChange={(e) => setEnteredBy(e.target.value)}
            style={{ ...baseInputStyle, ...(enteredBy.trim() ? {} : { border: "1px solid #ef4444" }) }}
          />
        </div>
      </section>

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <select value={participationMen} onChange={(e) => setParticipationMen(e.target.value)} style={{ ...baseInputStyle, background: "#fff", ...(participationMen ? {} : { border: "1px solid #ef4444" }) }}>
            <option value="">השתתפות גברים דינר פ"נ *</option>
            {participationOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select value={participationWomen} onChange={(e) => setParticipationWomen(e.target.value)} style={{ ...baseInputStyle, background: "#fff", ...(participationWomen ? {} : { border: "1px solid #ef4444" }) }}>
            <option value="">עדכון השתתפות נשים דינר פ"נ *</option>
            {participationWomenOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select value={donationAbility} onChange={(e) => setDonationAbility(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
            {donationAbilityOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt || "יכולת תרומה:"}
              </option>
            ))}
          </select>
          <select value={blessingOption} onChange={(e) => setBlessingOption(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
            {blessingOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt || "ברכה בספר הברכות"}
              </option>
            ))}
          </select>
          <input placeholder="ליד מי תרצו לשבת? (משתתף ראשי)" value={seatNearMain} onChange={(e) => setSeatNearMain(e.target.value)} style={baseInputStyle} />
        </div>
      </section>

      {(blessingOption === "הוספת פרטים עכשיו" || blessingOption === "שימוש בברכה של הדינר הקודם") && (
        <section>
          {blessingOption === "שימוש בברכה של הדינר הקודם" && (
            <div style={{ marginBottom: 12, background: "#f1f5f9", borderRadius: 12, padding: 12, fontSize: 14, color: "#0f172a" }}>
              {previousBlessingLoading && "טוען ברכה קודמת..."}
              {!previousBlessingLoading && previousBlessingError && <span>{previousBlessingError}</span>}
              {!previousBlessingLoading && !previousBlessingError && previousBlessingMeta && (
                <span>
                  הברכה נטענה מאירוע {previousBlessingMeta.eventName || ""}
                  {previousBlessingMeta.eventDate ? ` (${new Date(previousBlessingMeta.eventDate).toLocaleDateString()})` : ""}.
                </span>
              )}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <input
              placeholder="שם חותם הברכה"
              value={blessingSigner}
              onChange={(e) => setBlessingSigner(e.target.value)}
              style={compactInputStyle}
            />
            <textarea
              placeholder="תוכן הברכה *"
              value={blessingContent}
              onChange={(e) => setBlessingContent(e.target.value)}
              style={{ ...compactInputStyle, minHeight: 80 }}
            />
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0] || null;
                setBlessingLogo(file);
                // העלאת הקובץ מיד
                if (file) {
                  try {
                    const formData = new FormData();
                    formData.append('file', file);
                    const uploadRes = await fetch(`${apiBase}/public/forms/${token}/upload-blessing-file`, {
                      method: 'POST',
                      body: formData
                    });
                    if (uploadRes.ok) {
                      const uploadData = await uploadRes.json();
                      setBlessingFilePath(uploadData.file_path);
                    } else {
                      console.error('Error uploading file:', await uploadRes.text());
                    }
                  } catch (err) {
                    console.error('Error uploading file:', err);
                  }
                } else {
                  setBlessingFilePath(null);
                }
              }}
              style={compactInputStyle}
            />
          </div>
        </section>
      )}

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, justifyContent: "start" }}>
          {customFields.map((field) => renderCustomField(field))}
        </div>
      </section>

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, justifyContent: "start" }}>
          <select value={extraGuestsCount} onChange={(e) => handleExtraCountChange(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
            <option value="0">הבאת אורח/ת נוספ/ת *</option>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </div>
        {extraGuests.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {extraGuests.map((guest, index) => (
              <div
                key={index}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                  background: "#f8fafc",
                  padding: 12,
                  borderRadius: 12,
                }}
              >
                <input
                  placeholder={`שם פרטי משתתף (${index + 1})`}
                  value={guest.firstName}
                  onChange={(e) => setExtraGuest(index, { firstName: e.target.value })}
                  style={baseInputStyle}
                />
                <input
                  placeholder={`שם משפחה משתתף (${index + 1})`}
                  value={guest.lastName}
                  onChange={(e) => setExtraGuest(index, { lastName: e.target.value })}
                  style={baseInputStyle}
                />
                <input
                  placeholder={`מספר זהות משתתף (${index + 1})`}
                  value={guest.idNumber}
                  onChange={(e) => setExtraGuest(index, { idNumber: e.target.value })}
                  style={baseInputStyle}
                />
                <select
                  value={guest.gender}
                  onChange={(e) => setExtraGuest(index, { gender: e.target.value })}
                  style={{ ...baseInputStyle, background: "#fff" }}
                >
                  {guestGenderOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  placeholder={`ליד מי תרצו לשבת? (משתתף ${index + 1})`}
                  value={guest.seatNear}
                  onChange={(e) => setExtraGuest(index, { seatNear: e.target.value })}
                  style={baseInputStyle}
                />
              </div>
            ))}
          </div>
        )}
      </section>

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
          {status.submitting ? "שולח..." : "שלח טופס"}
        </button>
      </div>
    </form>
  );
}
