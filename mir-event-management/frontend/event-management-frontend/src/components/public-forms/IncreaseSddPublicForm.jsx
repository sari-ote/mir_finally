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

const DONATION_ABILITY = [
  "",
  "הו\"ק גבוהה",
  "הו\"ק רגילה",
  "יכולת גבוהה",
  "לא ידוע",
  "VIP",
];

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

export default function IncreaseSddPublicForm({ token, apiBase, formMeta, onSuccess, onError }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [spouseName, setSpouseName] = useState("");
  const [idNumber, setIdNumber] = useState("");

  const [dialCode, setDialCode] = useState(PHONE_CODES[0].value);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [buildingNumber, setBuildingNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [occupation, setOccupation] = useState("");

  const [sddIncrease, setSddIncrease] = useState("");
  const [participationWomen, setParticipationWomen] = useState("");
  const [participationMen, setParticipationMen] = useState("");
  const [donationAbility, setDonationAbility] = useState("");
  const [remarks, setRemarks] = useState("");
  const [enteredBy, setEnteredBy] = useState("");
  const [blessingOption, setBlessingOption] = useState("");
  const [blessingSigner, setBlessingSigner] = useState("");
  const [blessingContent, setBlessingContent] = useState("");
  const [blessingLogo, setBlessingLogo] = useState(null);
  const [blessingFilePath, setBlessingFilePath] = useState(null);
  const [previousBlessingMeta, setPreviousBlessingMeta] = useState(null);
  const [previousBlessingError, setPreviousBlessingError] = useState(null);
  const [previousBlessingLoading, setPreviousBlessingLoading] = useState(false);
  const [seatNearMain, setSeatNearMain] = useState("");

  const [extraGuestsMain, setExtraGuestsMain] = useState("0");
  const [extraGuests, setExtraGuests] = useState([]);

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

  useEffect(() => {
    const count = Number(extraGuestsMain) || 0;
    setExtraGuests((prev) => {
      const arr = [...prev];
      if (count > arr.length) {
        while (arr.length < count) arr.push({ firstName: "", lastName: "", idNumber: "", gender: "", seatNear: "" });
      } else if (count < arr.length) {
        arr.length = count;
      }
      return arr;
    });
  }, [extraGuestsMain]);

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

  const validate = () => {
    if (!firstName.trim()) return "יש להזין שם פרטי";
    if (!lastName.trim()) return "יש להזין שם משפחה";
    if (!idNumber.trim()) return "יש להזין תעודת זהות";
    if (!isIsraeliIdValid(idNumber)) return "מספר הזהות אינו תקין";
    if (!phone.trim()) return "יש להזין מספר נייד";
    if (!isPhoneValid(phone, dialCode)) return "מספר הטלפון אינו תקין";
    if (!spouseName.trim()) return "יש להזין שם בת הזוג";
    if (!participationWomen) return "יש לבחור השתתפות נשים";
    if (!participationMen) return "יש לבחור השתתפות גברים";
    if (!enteredBy.trim()) return "יש להזין מי הכניס למערכת";
    if (email.trim() && !isEmailValid(email)) return "האימייל שהוזן אינו תקין";

    const missingRequiredCustom = (formMeta?.custom_fields || []).some(
      (field) => field.required && !String(customValues[field.id] || "").trim()
    );
    if (missingRequiredCustom) return "יש למלא את כל השדות הנוספים החובה";
    return null;
  };

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setSpouseName("");
    setIdNumber("");
    setDialCode(PHONE_CODES[0].value);
    setPhone("");
    setEmail("");
    setStreet("");
    setCity("");
    setNeighborhood("");
    setBuildingNumber("");
    setApartment("");
    setOccupation("");
    setSddIncrease("");
    setParticipationWomen("");
    setParticipationMen("");
    setDonationAbility("");
    setRemarks("");
    setEnteredBy("");
    setBlessingOption("");
    setBlessingSigner("");
    setBlessingContent("");
    setBlessingLogo(null);
    setPreviousBlessingMeta(null);
    setPreviousBlessingError(null);
    setPreviousBlessingLoading(false);
    setSeatNearMain("");
    setExtraGuestsMain("0");
    setExtraGuests([]);
    setCustomValues(() => {
      const map = {};
      (formMeta?.custom_fields || []).forEach((field) => {
        map[field.id] = "";
      });
      return map;
    });
    setStatus({ submitting: false, success: false, error: null });
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

    const payload = {
      base: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        id_number: idNumber.trim(),
        phone: `${dialCode} ${phone}`.trim(),
        email: email.trim() || null,
        gender: "male",
        referral_source: "increase_sdd_public",
        spouse_name: spouseName.trim(),
        street: street.trim() || null,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        building_number: buildingNumber.trim() || null,
        apartment: apartment.trim() || null,
        occupation: occupation.trim() || null,
        sdd_increase: sddIncrease || null,
        participation_women: participationWomen,
        participation_men: participationMen,
        donation_ability: donationAbility || null,
        remarks: remarks || null,
        entered_by: enteredBy.trim(),
        blessing_option: blessingOption || null,
        blessing_signer:
          blessingOption === "הוספת פרטים עכשיו" || blessingOption === "שימוש בברכה של הדינר הקודם"
            ? blessingSigner || null
            : null,
        blessing_content:
          blessingOption === "הוספת פרטים עכשיו" || blessingOption === "שימוש בברכה של הדינר הקודם"
            ? blessingContent || null
            : null,
        blessing_file_path: blessingFilePath || null,
        blessing_file_name: blessingLogo?.name || null,
        blessing_logo_name: blessingLogo?.name || null,  // שמירה גם בשם הישן לתאימות
        seat_near_main: seatNearMain || null,
        extra_guests_count: extraGuestsMain,
      },
      custom: Object.entries(customValues).map(([fieldId, value]) => ({
        field_id: Number(fieldId),
        value: value ?? "",
      })),
      extra: {
        extra_guests: extraGuests
          .filter((guest) => (guest.firstName || "").trim() || (guest.lastName || "").trim())
          .map((guest) => ({
            first_name: (guest.firstName || "").trim(),
            last_name: (guest.lastName || "").trim(),
            id_number: (guest.idNumber || "").trim(),
            gender: guest.gender,
            seat_near: (guest.seatNear || "").trim(),
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
      if (onSuccess) onSuccess();
      resetForm();
    } catch (error) {
      const message = error.message || "שליחה נכשלה";
      setStatus({ submitting: false, success: false, error: message });
      if (onError) onError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 24 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", margin: 0 }}>עד לפתיחת שערים</h1>
      </div>

      {status.error && (
        <div style={{ background: "#fee2e2", borderRadius: 12, padding: 12, color: "#b91c1c", textAlign: "center", fontWeight: 600 }}>
          {status.error}
        </div>
      )}
      {status.success && (
        <div style={{ background: "#dcfce7", borderRadius: 12, padding: 12, color: "#15803d", textAlign: "center", fontWeight: 600 }}>
          הטופס נשלח בהצלחה!
        </div>
      )}

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
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
        </div>
      </section>

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <input placeholder="מספר בניין" value={buildingNumber} onChange={(e) => setBuildingNumber(e.target.value)} style={baseInputStyle} />
          <input placeholder="מספר דירה" value={apartment} onChange={(e) => setApartment(e.target.value)} style={baseInputStyle} />
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
          <input placeholder="שכונה" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} style={baseInputStyle} />
          <input placeholder="עיסוק" value={occupation} onChange={(e) => setOccupation(e.target.value)} style={baseInputStyle} />
          <input placeholder="שם בת הזוג" value={spouseName} onChange={(e) => setSpouseName(e.target.value)} style={baseInputStyle} />
        </div>
      </section>

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <select value={sddIncrease} onChange={(e) => setSddIncrease(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
            <option value="">הגדלת הו"ק חודשית ב:</option>
            {Array.from({ length: 12 }, (_, i) => (i + 1) * 100).map((amount) => (
              <option key={amount} value={`${amount}₪`}>
                {`${amount}₪`}
              </option>
            ))}
          </select>
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
      </section>

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <select value={blessingOption} onChange={(e) => setBlessingOption(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
            <option value="">ברכה בספר הברכות</option>
            <option value="הוספת פרטים עכשיו">הוספת פרטים עכשיו</option>
            <option value="לא נצרך">לא נצרך</option>
            <option value="שימוש בברכה של הדינר הקודם">שימוש בברכה של הדינר הקודם</option>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <input placeholder="שם חותם הברכה" value={blessingSigner} onChange={(e) => setBlessingSigner(e.target.value)} style={compactInputStyle} />
            <textarea placeholder="תוכן הברכה *" value={blessingContent} onChange={(e) => setBlessingContent(e.target.value)} style={{ ...compactInputStyle, minHeight: 60 }} />
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <select value={donationAbility} onChange={(e) => setDonationAbility(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
            {DONATION_ABILITY.map((opt) => (
              <option key={opt} value={opt}>
                {opt || "יכולת תרומה:"}
              </option>
            ))}
          </select>
          <select
            value={(extraGuestsMain === "" || extraGuestsMain === "0" || extraGuestsMain === 0) ? "" : extraGuestsMain}
            onChange={(e) => setExtraGuestsMain(e.target.value)}
            style={{ ...baseInputStyle, background: "#fff" }}
          >
            <option value="" disabled>
              הבאת אורח/ת נוספ/ת *
            </option>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section>
        <textarea
          placeholder="הערות"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          style={{ ...baseInputStyle, minHeight: 80 }}
        />
      </section>

      {extraGuests.length > 0 && (
        <section>
          {extraGuests.map((guest, index) => (
            <div
              key={index}
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
                background: "#f8fafc",
                padding: 12,
                borderRadius: 10,
              }}
            >
              <input
                placeholder={`שם פרטי משתתף (${index + 1})`}
                value={guest.firstName}
                onChange={(e) => setExtraGuests((prev) => {
                  const arr = [...prev];
                  arr[index] = { ...arr[index], firstName: e.target.value };
                  return arr;
                })}
                style={baseInputStyle}
              />
              <input
                placeholder={`שם משפחה משתתף (${index + 1})`}
                value={guest.lastName}
                onChange={(e) => setExtraGuests((prev) => {
                  const arr = [...prev];
                  arr[index] = { ...arr[index], lastName: e.target.value };
                  return arr;
                })}
                style={baseInputStyle}
              />
              <input
                placeholder={`מספר זהות משתתף (${index + 1})`}
                value={guest.idNumber}
                onChange={(e) => setExtraGuests((prev) => {
                  const arr = [...prev];
                  arr[index] = { ...arr[index], idNumber: e.target.value };
                  return arr;
                })}
                style={baseInputStyle}
              />
              <select
                value={guest.gender}
                onChange={(e) => setExtraGuests((prev) => {
                  const arr = [...prev];
                  arr[index] = { ...arr[index], gender: e.target.value };
                  return arr;
                })}
                style={{ ...baseInputStyle, background: "#fff" }}
              >
                <option value="">מגדר</option>
                <option value="זכר">זכר</option>
                <option value="נקבה">נקבה</option>
              </select>
              <input
                placeholder={`ליד מי תרצו לשבת? (משתתף ${index + 1})`}
                value={guest.seatNear}
                onChange={(e) => setExtraGuests((prev) => {
                  const arr = [...prev];
                  arr[index] = { ...arr[index], seatNear: e.target.value };
                  return arr;
                })}
                style={baseInputStyle}
              />
            </div>
          ))}
        </section>
      )}

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
          {status.submitting ? "שולח..." : "שמירה"}
        </button>
      </div>
    </form>
  );
}
