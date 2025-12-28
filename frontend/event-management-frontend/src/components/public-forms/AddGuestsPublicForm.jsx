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

const PARTICIPATION_MEN = [
  "השתתפות יחיד",
  "לא משתתף אחר",
  "לא משתתף חו\"ל",
  "לא משתתף עם משפחתית",
  "ספק",
];

const PARTICIPATION_WOMEN = [
  "השתתפות יחידה נשים",
  "לא משתתפת אחר",
  "לא משתתפת חו\"ל",
  "לא משתתפת עם משפחתית",
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

export default function AddGuestsPublicForm({ token, apiBase, formMeta, onSuccess, onError }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [spouseName, setSpouseName] = useState("");

  const [dialCode, setDialCode] = useState(PHONE_CODES[0].value);
  const [phone, setPhone] = useState("");
  const [altDialCode, setAltDialCode] = useState(PHONE_CODES[0].value);
  const [altPhone, setAltPhone] = useState("");
  const [email, setEmail] = useState("");

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [buildingNumber, setBuildingNumber] = useState("");
  const [occupation, setOccupation] = useState("");

  const [participationMen, setParticipationMen] = useState("");
  const [participationWomen, setParticipationWomen] = useState("");
  const [donationAbility, setDonationAbility] = useState("");
  const [enteredBy, setEnteredBy] = useState("");
  const [groupAssociation, setGroupAssociation] = useState("ללא שיוך");
  const [remarks, setRemarks] = useState("");
  const [tableHeads, setTableHeads] = useState([]);

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

  useEffect(() => {
    const fetchTableHeads = async () => {
      try {
        const res = await fetch(`${apiBase}/public/forms/${token}/table-heads`);
        if (!res.ok) {
          throw new Error("טעינת ראשי שולחנות נכשלה");
        }
        const data = await res.json();
        setTableHeads(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load table heads", error);
        setTableHeads([]);
      }
    };

    fetchTableHeads();
  }, [apiBase, token]);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setSpouseName("");
    setDialCode(PHONE_CODES[0].value);
    setPhone("");
    setAltDialCode(PHONE_CODES[0].value);
    setAltPhone("");
    setEmail("");
    setStreet("");
    setCity("");
    setNeighborhood("");
    setBuildingNumber("");
    setOccupation("");
    setParticipationMen("");
    setParticipationWomen("");
    setDonationAbility("");
    setEnteredBy("");
    setGroupAssociation("ללא שיוך");
    setRemarks("");
    setCustomValues(() => {
      const map = {};
      (formMeta?.custom_fields || []).forEach((field) => {
        map[field.id] = "";
      });
      return map;
    });
  };

  const validate = () => {
    if (!firstName.trim()) return "יש להזין שם פרטי";
    if (!lastName.trim()) return "יש להזין שם משפחה";
    if (!spouseName.trim()) return "יש להזין שם בת הזוג";
    if (!phone.trim()) return "יש להזין מספר נייד";
    if (!participationMen) return "יש לבחור השתתפות גברים";
    if (!participationWomen) return "יש לבחור השתתפות נשים";
    if (!enteredBy.trim()) return "יש להזין מי הכניס למערכת";
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

    const payload = {
      base: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        id_number: "",
        phone: `${dialCode} ${phone}`.trim(),
        email: email.trim() || null,
        gender: "male",
        referral_source: "add_guests_public",
        spouse_name: spouseName.trim(),
        alt_phone: altPhone ? `${altDialCode} ${altPhone}`.trim() : null,
        street: street.trim() || null,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        building_number: buildingNumber.trim() || null,
        occupation: occupation.trim() || null,
        participation_men: participationMen,
        participation_women: participationWomen,
        donation_ability: donationAbility || null,
        entered_by: enteredBy.trim(),
        group_association: groupAssociation || null,
        remarks: remarks.trim() || null,
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

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 24 }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: "#0f172a" }}>יש להכין את מספר הפרטים המרובים</h1>
        <p style={{ marginTop: 8, color: "#475569", fontSize: 16 }}>כדי שנוכל להושיב אתכם במקומות הראויים ביותר</p>
      </div>

      {status.error && (
        <div style={{ background: "#fee2e2", borderRadius: 12, padding: 12, color: "#b91c1c", textAlign: "center", fontWeight: 600 }}>
          {status.error}
        </div>
      )}
      {status.success && (
        <div style={{ background: "#dcfce7", borderRadius: 12, padding: 12, color: "#15803d", textAlign: "center", fontWeight: 600 }}>
          הטופס נשלח בהצלחה! תודה על העדכון.
        </div>
      )}

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <input placeholder="שם פרטי" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={baseInputStyle} />
          <input placeholder="שם משפחה" value={lastName} onChange={(e) => setLastName(e.target.value)} style={baseInputStyle} />
          <input placeholder="שם בת הזוג" value={spouseName} onChange={(e) => setSpouseName(e.target.value)} style={baseInputStyle} />
        </div>
      </section>

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
            <select value={altDialCode} onChange={(e) => setAltDialCode(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
              {PHONE_CODES.map((code) => (
                <option key={code.value} value={code.value}>
                  {code.label}
                </option>
              ))}
            </select>
            <input placeholder="טלפון נוסף" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} style={baseInputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
            <select value={dialCode} onChange={(e) => setDialCode(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
              {PHONE_CODES.map((code) => (
                <option key={code.value} value={code.value}>
                  {code.label}
                </option>
              ))}
            </select>
            <input placeholder="מספר נייד" value={phone} onChange={(e) => setPhone(e.target.value)} style={baseInputStyle} />
          </div>
          <input placeholder="מייל" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...baseInputStyle, ...(email.trim() && !isEmailValid(email) ? { border: "1px solid #ef4444" } : {}) }} />
        </div>
      </section>

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <input placeholder="שכונה" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} style={baseInputStyle} />
          <input placeholder="מספר בנין" value={buildingNumber} onChange={(e) => setBuildingNumber(e.target.value)} style={baseInputStyle} />
          <input placeholder="רחוב" value={street} onChange={(e) => setStreet(e.target.value)} style={baseInputStyle} />
        </div>
      </section>

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <select value={participationMen} onChange={(e) => setParticipationMen(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
            <option value="">השתתפות גברים דינר פ"נ *</option>
            {PARTICIPATION_MEN.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <input placeholder="עיסוק" value={occupation} onChange={(e) => setOccupation(e.target.value)} style={baseInputStyle} />
          <input placeholder="עיר" value={city} onChange={(e) => setCity(e.target.value)} style={baseInputStyle} />
        </div>
      </section>

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <input placeholder='הוכנס למערכת ע"י *' value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} style={baseInputStyle} />
          <select value={donationAbility} onChange={(e) => setDonationAbility(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
            {DONATION_ABILITY.map((opt) => (
              <option key={opt} value={opt}>
                {opt || "יכולת תרומה:"}
              </option>
            ))}
          </select>
          <select value={participationWomen} onChange={(e) => setParticipationWomen(e.target.value)} style={{ ...baseInputStyle, background: "#fff" }}>
            <option value="">עדכון השתתפות נשים דינר פ"נ *</option>
            {PARTICIPATION_WOMEN.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
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

      <section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <select
            value={groupAssociation}
            onChange={(e) => setGroupAssociation(e.target.value)}
            style={{ ...baseInputStyle, background: "#fff" }}
          >
            <option value="ללא שיוך">ללא שיוך</option>
            {tableHeads.map((head) => (
              <option key={head.id} value={head.last_name}>
                {head.last_name}
              </option>
            ))}
          </select>
          <textarea placeholder="הערות" value={remarks} onChange={(e) => setRemarks(e.target.value)} style={{ ...baseInputStyle, minHeight: 120 }} />
        </div>
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
