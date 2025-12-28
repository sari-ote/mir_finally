/**
 * דוגמה: איך ליישם עיצוב טרופי על Login.jsx
 * 
 * זהו קובץ דוגמה - לא להשתמש ישירות!
 * העתק את השינויים ל-Login.jsx שלך
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import loginImage from "../images/login.png";
import TropicalWrapper from "../components/TropicalWrapper"; // ✅ הוסף את זה

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // ... כל הלוגיקה הקיימת נשארת בדיוק אותו דבר ...

  return (
    <TropicalWrapper force={true}> {/* ✅ עטוף את כל הקומפוננט */}
      <div className="page-shell" style={{ 
        backgroundImage: `url(${loginImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative'
      }}>
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(2px)'
          }}
        />
        <div className="page-shell__inner" style={{ position: 'relative', zIndex: 2 }}>
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "100vh",
              maxWidth: "400px",
              margin: "0 auto",
              padding: "40px 20px",
            }}
          >
            <h2 style={{ 
              color: "white", 
              marginBottom: "32px",
              fontSize: "2rem",
              fontWeight: 600
            }}>
              התחברות
            </h2>
            
            {/* ✅ שימוש ב-Class Names הטרופיים */}
            <input
              type="email"
              placeholder="אימייל"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="tropical-input" // ✅ שינוי כאן
              style={{ marginBottom: "16px", width: "100%" }}
            />
            
            <input
              type="password"
              placeholder="סיסמה"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="tropical-input" // ✅ שינוי כאן
              style={{ marginBottom: "24px", width: "100%" }}
            />
            
            <button 
              type="submit" 
              className="tropical-button-primary" // ✅ שינוי כאן
              style={{ width: "100%" }}
            >
              התחבר
            </button>
            
            {error && (
              <div 
                className="tropical-alert tropical-alert-error" // ✅ שינוי כאן
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

/**
 * שינויים שבוצעו:
 * 
 * 1. ✅ הוספתי import של TropicalWrapper
 * 2. ✅ עטפתי את כל הקומפוננט ב-<TropicalWrapper force={true}>
 * 3. ✅ שיניתי className="form-input" ל-className="tropical-input"
 * 4. ✅ שיניתי className="form-button primary" ל-className="tropical-button-primary"
 * 5. ✅ שיניתי את ה-error ל-tropical-alert tropical-alert-error
 * 6. ✅ הוספתי page-shell ו-page-shell__inner למבנה
 * 
 * ⚠️ חשוב: הלוגיקה נשארה בדיוק אותו דבר!
 */

