import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // ✅
import loginImage from "../../images/login.png";
import TropicalWrapper from "../TropicalWrapper";
import "../../styles/theme-tropical.css";


export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate(); // ✅

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://localhost:8001/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401) {
          setError("שם משתמש או סיסמה שגויים");
        } else {
          setError(data.detail || "שגיאה בכניסה");
        }
        return;
      }
      
      const data = await response.json();
      console.log("💡 תגובת התחברות:", data);
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_id", data.user.id);
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("full_name", data.user.full_name);

      // ניתוב חכם לצופה: מצא אירוע מורשה והיכנס אליו מיד
      try {
        const permsRes = await fetch(`http://localhost:8001/permissions/user/${data.user.id}`, {
          headers: { Authorization: `Bearer ${data.access_token}` }
        });
        const perms = await permsRes.json();
        if (Array.isArray(perms) && perms.length > 0) {
          // סדר עדיפות: אם יש ממש viewer, קח אותו; אחרת קח כל אירוע שיש הרשאה אליו
          let first = perms.find(p => p.role_in_event === 'viewer') || perms[0];
          localStorage.setItem('last_event_id', first.event_id);
          navigate(`/events/${first.event_id}`);
          return;
        }
      } catch (e) {
        console.warn('permissions fetch failed', e);
      }

      navigate("/admin");
    } catch (err) {
      setError("תקלה בשרת, נסי שנית");
    }
  }

  return (
    <TropicalWrapper force={true}>
      <div className="page-shell" style={{ 
        position: "relative",
        width: "100vw",
        height: "100vh",
        backgroundImage: `url(${loginImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
            zIndex: 1,
          }}
        />
        <div className="page-shell__inner" style={{ 
          position: 'relative', 
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}>
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              maxWidth: "400px",
              width: "100%",
              padding: "40px 24px",
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              borderRadius: "24px",
              boxShadow: "0 16px 40px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h2 style={{ 
              color: "var(--color-text-main, #10131A)", 
              marginBottom: "32px",
              fontSize: "2rem",
              fontWeight: 600,
            }}>
              התחברות
            </h2>
            <input
              type="email"
              placeholder="אימייל"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="tropical-input"
              style={{ marginBottom: "16px", width: "100%" }}
            />
            <input
              type="password"
              placeholder="סיסמה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="tropical-input"
              style={{ marginBottom: "24px", width: "100%" }}
            />
            <button 
              type="submit" 
              className="tropical-button-primary"
              style={{ width: "100%" }}
            >
              התחבר
            </button>
            {error && (
              <div 
                className="tropical-alert tropical-alert-error"
                style={{ marginTop: "16px", width: "100%" }}
              >
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </TropicalWrapper>
  );
}
