import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import VipPublicForm from "../components/public-forms/VipPublicForm.jsx";
import NewDonorsPublicForm from "../components/public-forms/NewDonorsPublicForm.jsx";
import WomenSeatingPublicForm from "../components/public-forms/WomenSeatingPublicForm.jsx";
import AddGuestsPublicForm from "../components/public-forms/AddGuestsPublicForm.jsx";
import IncreaseSddPublicForm from "../components/public-forms/IncreaseSddPublicForm.jsx";
import TropicalWrapper from "../components/TropicalWrapper";
import "../styles/theme-tropical.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8001";

const PublicFormPage = () => {
  const { token } = useParams();
  const [formMeta, setFormMeta] = useState(null);
  const [baseValues, setBaseValues] = useState({});
  const [customValues, setCustomValues] = useState({});
  const [status, setStatus] = useState({ loading: true, error: null, submitted: false, submitting: false });

  useEffect(() => {
    let cancelled = false;
    const fetchForm = async () => {
      setStatus((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch(`${API_BASE}/public/forms/${token}`);
        if (!res.ok) {
          const message = res.status === 410 ? "הקישור אינו פעיל" : "הטופס לא נמצא";
          throw new Error(message);
        }
        const data = await res.json();
        if (cancelled) return;
        const defaults = {};
        data.base_fields.forEach((field) => {
          defaults[field.key] = "";
        });
        setFormMeta(data);
        setBaseValues(defaults);
        setCustomValues({});
        setStatus((prev) => ({ ...prev, loading: false }));
      } catch (error) {
        if (!cancelled) {
          setStatus({ loading: false, error: error.message, submitted: false, submitting: false });
        }
      }
    };
    if (token) fetchForm();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const requiredErrors = useMemo(() => {
    if (!formMeta) return [];
    const errors = [];
    formMeta.base_fields.forEach((field) => {
      if (field.required && !baseValues[field.key]) {
        errors.push(field.label);
      }
    });
    formMeta.custom_fields.forEach((field) => {
      if (field.required && !customValues[field.id]) {
        errors.push(field.label);
      }
    });
    return errors;
  }, [formMeta, baseValues, customValues]);

  const handleBaseChange = (key, value) => {
    setBaseValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleCustomChange = (fieldId, value) => {
    setCustomValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formMeta) return;
    if (requiredErrors.length > 0) {
      setStatus((prev) => ({ ...prev, error: `חובה למלא: ${requiredErrors.join(", ")}` }));
      return;
    }
    setStatus((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      const payload = {
        base: baseValues,
        custom: Object.entries(customValues).map(([fieldId, value]) => ({
          field_id: Number(fieldId),
          value: value ?? "",
        })),
      };
      const res = await fetch(`${API_BASE}/public/forms/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "שליחה נכשלה");
      }
      setStatus({ loading: false, error: null, submitted: true, submitting: false });
      setCustomValues({});
      setBaseValues((prev) => {
        const cleared = { ...prev };
        Object.keys(cleared).forEach((key) => (cleared[key] = ""));
        return cleared;
      });
    } catch (error) {
      setStatus((prev) => ({ ...prev, error: error.message, submitting: false }));
    }
  };

  const renderFieldInput = (field, value, onChange) => {
    const baseStyle = { padding: "14px 16px", borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", width: "100%" };
    const tropicalInputClass = "tropical-input";

    if (field.field_type === "select") {
      return (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="tropical-input"
          style={{ ...baseStyle, appearance: "none" }}
        >
          <option value="">בחר</option>
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            style={{ width: 20, height: 20 }}
          />
          <span style={{ color: "#475569", fontWeight: 500 }}>בחר/י</span>
        </div>
      );
    }

    return (
      <input
        type={field.field_type === "number" ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        className={tropicalInputClass}
        style={baseStyle}
        autoComplete="off"
      />
    );
  };

  const renderField = (field) => {
    const label = field.label || field.name || field.key;
    const isRequired = field.required;

    if ("key" in field) {
      return (
        <div key={field.key} style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 700, color: "#0f172a" }}>
            {label}
            {isRequired && <span style={{ color: "#ef4444" }}> *</span>}
          </label>
          {renderFieldInput(field, baseValues[field.key], (val) => handleBaseChange(field.key, val))}
        </div>
      );
    }

    return (
      <div key={field.id} style={{ display: "grid", gap: 6 }}>
        <label style={{ fontWeight: 700, color: "#0f172a" }}>
          {label}
          {isRequired && <span style={{ color: "#ef4444" }}> *</span>}
        </label>
        {renderFieldInput(field, customValues[field.id], (val) => handleCustomChange(field.id, val))}
      </div>
    );
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  };

  if (status.loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7" }}>
        טוען טופס...
      </div>
    );
  }

  if (status.error && !formMeta) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f5f7" }}>
        <div
          style={{
            background: "#fff1f2",
            padding: 28,
            borderRadius: 16,
            color: "#b91c1c",
            boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
            maxWidth: 420,
            textAlign: "center",
          }}
        >
          {status.error}
        </div>
      </div>
    );
  }

  if (!formMeta) return null;

  if (formMeta.form_key === "new-donors") {
    return (
      <TropicalWrapper>
      <div className="page-shell" dir="rtl" style={{ minHeight: "100vh", padding: "48px 16px" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: 24,
            padding: 32,
            boxShadow: "0 18px 48px rgba(15,23,42,0.14)",
            border: "1px solid #e2e8f0",
          }}
        >
          <NewDonorsPublicForm
            token={token}
            apiBase={API_BASE}
            formMeta={formMeta}
            onSuccess={() => setStatus({ loading: false, error: null, submitted: true, submitting: false })}
            onError={(message) => setStatus((prev) => ({ ...prev, error: message }))}
          />
        </div>
      </div>
      </TropicalWrapper>
    );
  }

  if (formMeta.form_key === "add-guests") {
    return (
      <TropicalWrapper>
      <div className="page-shell" dir="rtl" style={{ minHeight: "100vh", padding: "48px 16px" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: 24,
            padding: 32,
            boxShadow: "0 18px 48px rgba(15,23,42,0.14)",
            border: "1px solid #e2e8f0",
          }}
        >
          <AddGuestsPublicForm
            token={token}
            apiBase={API_BASE}
            formMeta={formMeta}
            onSuccess={() => setStatus({ loading: false, error: null, submitted: true, submitting: false })}
            onError={(message) => setStatus((prev) => ({ ...prev, error: message }))}
          />
        </div>
      </div>
      </TropicalWrapper>
    );
  }

  if (formMeta.form_key === "increase-sdd") {
    return (
      <TropicalWrapper>
      <div className="page-shell" dir="rtl" style={{ minHeight: "100vh", padding: "48px 16px" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: 24,
            padding: 32,
            boxShadow: "0 18px 48px rgba(15,23,42,0.14)",
            border: "1px solid #e2e8f0",
          }}
        >
          <IncreaseSddPublicForm
            token={token}
            apiBase={API_BASE}
            formMeta={formMeta}
            onSuccess={() => setStatus({ loading: false, error: null, submitted: true, submitting: false })}
            onError={(message) => setStatus((prev) => ({ ...prev, error: message }))}
          />
        </div>
      </div>
      </TropicalWrapper>
    );
  }

  if (formMeta.form_key === "women-seating-update") {
    return (
      <TropicalWrapper>
      <div className="page-shell" dir="rtl" style={{ minHeight: "100vh", padding: "48px 16px" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: 24,
            padding: 32,
            boxShadow: "0 18px 48px rgba(15,23,42,0.14)",
            border: "1px solid #e2e8f0",
          }}
        >
          <WomenSeatingPublicForm
            token={token}
            apiBase={API_BASE}
            formMeta={formMeta}
            onSuccess={() => setStatus({ loading: false, error: null, submitted: true, submitting: false })}
            onError={(message) => setStatus((prev) => ({ ...prev, error: message }))}
          />
        </div>
      </div>
      </TropicalWrapper>
    );
  }

  if (formMeta.form_key === "vip-registration") {
    return (
      <TropicalWrapper>
      <div className="page-shell" dir="rtl" style={{ minHeight: "100vh", padding: "48px 16px" }}>
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: 24,
            padding: 32,
            boxShadow: "0 18px 48px rgba(15,23,42,0.14)",
            border: "1px solid #e2e8f0",
          }}
        >
          <VipPublicForm
            token={token}
            apiBase={API_BASE}
            formMeta={formMeta}
            onSuccess={() => setStatus({ loading: false, error: null, submitted: true, submitting: false })}
            onError={(message) => setStatus((prev) => ({ ...prev, error: message }))}
          />
        </div>
      </div>
      </TropicalWrapper>
    );
  }

  const formTitle = formMeta.event_name || "אירוע";

  return (
    <TropicalWrapper>
    <div className="page-shell" dir="rtl" style={{ minHeight: "100vh", padding: "48px 16px" }}>
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          background: "#ffffff",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 18px 48px rgba(15,23,42,0.14)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{formTitle}</h1>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 16 }}>נא להזין את הפרטים הנדרשים ולשלוח.</p>
        </div>

        {status.error && (
          <div
            style={{
              background: "#fee2e2",
              borderRadius: 14,
              padding: 12,
              marginBottom: 16,
              color: "#b91c1c",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            {status.error}
          </div>
        )}
        {status.submitted && (
          <div
            style={{
              background: "#dcfce7",
              borderRadius: 14,
              padding: 12,
              marginBottom: 16,
              color: "#15803d",
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            הטופס נשלח בהצלחה!
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 24 }}>
          <section>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: "#1e293b" }}>פרטי מוזמן</h2>
            <div style={gridStyle}>{formMeta.base_fields.map(renderField)}</div>
          </section>

          {formMeta.custom_fields.length > 0 && (
            <section>
              <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: "#1e293b" }}>שדות נוספים</h2>
              <div style={gridStyle}>{formMeta.custom_fields.map(renderField)}</div>
            </section>
          )}

          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
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
      </div>
    </div>
    </TropicalWrapper>
  );
};

export default PublicFormPage;
