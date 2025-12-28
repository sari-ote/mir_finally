import React, { useState, useEffect } from "react";
import "../../styles/theme-tropical.css";

export default function UserManagement({ eventId }) {
  const [users, setUsers] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [newUser, setNewUser] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
    role: "event_manager"
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPerm, setNewPerm] = useState({ user_id: "", role_in_event: "event_admin" });
  const [editPermId, setEditPermId] = useState(null);
  const [editPermRole, setEditPermRole] = useState("");
  const token = localStorage.getItem("access_token");
  const myUserId = localStorage.getItem("user_id");
  const myRole = localStorage.getItem("role");

  const translateSystemRole = (role) => {
    switch (role) {
      case "admin":
        return "מנהל מערכת";
      case "event_manager":
        return "מנהל אירוע";
      case "viewer":
        return "צופה";
      default:
        return role;
    }
  };

  const fetchUsers = () => {
    fetch("http://localhost:8001/users", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setUsers(data));
  };
  const fetchPermissions = () => {
    fetch(`http://localhost:8001/permissions/event/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setPermissions(Array.isArray(data) ? data : []));
  };

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
  }, [eventId]);

  const handleChange = (e) => {
    setNewUser({ ...newUser, [e.target.name]: e.target.value });
  };

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  const handleAddUser = () => {
    if (!isValidEmail(newUser.email)) {
      alert("אימייל לא תקין");
      return;
    }
    fetch("http://localhost:8001/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(newUser),
    })
      .then(res => {
        if (!res.ok) throw new Error("שגיאה בהוספה");
        return res.json();
      })
      .then(() => {
        setNewUser({ username: "", full_name: "", email: "", password: "", role: "event_manager" });
        setShowAddForm(false);
        fetchUsers();
      })
      .catch(err => alert(err.message));
  };

  const handleDelete = (id) => {
    fetch(`http://localhost:8001/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      .then(() => fetchUsers());
  };

  // הרשאות
  const handlePermChange = (e) => {
    setNewPerm({ ...newPerm, [e.target.name]: e.target.value });
  };
  const handleAddPerm = () => {
    if (!newPerm.user_id || !newPerm.role_in_event) {
      alert("יש לבחור משתמש ותפקיד");
      return;
    }
    const payload = {
      user_id: Number(newPerm.user_id),
      event_id: Number(eventId),
      role_in_event: newPerm.role_in_event
    };
    console.log("[DEBUG] Payload sent to /permissions:", payload);
    fetch("http://localhost:8001/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
      .then(res => {
        if (!res.ok) throw new Error("שגיאה בהוספת הרשאה");
        return res.json();
      })
      .then(() => {
        setNewPerm({ user_id: "", role_in_event: "event_admin" });
        fetchPermissions();
      })
      .catch(err => alert(err.message));
  };
  const handleDeletePerm = (id) => {
    fetch(`http://localhost:8001/permissions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      .then(() => fetchPermissions());
  };

  const handleSavePerm = (id) => {
    fetch(`http://localhost:8001/permissions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role_in_event: editPermRole }),
    })
      .then(res => {
        if (!res.ok) throw new Error("שגיאה בעדכון הרשאה");
        return res.json();
      })
      .then(() => {
        setEditPermId(null);
        fetchPermissions();
      })
      .catch(err => alert(err.message));
  };

  const handleInlinePermChange = (permId, newRole) => {
    fetch(`http://localhost:8001/permissions/${permId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role_in_event: newRole })
    })
      .then(res => {
        if (!res.ok) throw new Error("שגיאה בעדכון הרשאה");
        return res.json();
      })
      .then(() => fetchPermissions())
      .catch(err => alert(err.message));
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>👤 ניהול משתמשים</h2>
        <button
          onClick={() => setShowAddForm(v => !v)}
          style={{
            background: showAddForm ? "#0f172a" : "#111827",
            color: "#e5e7eb",
            border: "1px solid #1f2937",
            padding: "10px 14px",
            borderRadius: 8,
            cursor: "pointer"
          }}
        >
          {showAddForm ? "בטל" : "➕ הוספת משתמש חדש"}
        </button>
      </div>

      {showAddForm && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          padding: 16,
          borderRadius: 10,
          marginBottom: 20
        }}>
          <input name="username" placeholder="שם משתמש" value={newUser.username} onChange={handleChange} style={{ gridColumn: "span 2" }} />
          <input name="full_name" placeholder="שם מלא" value={newUser.full_name} onChange={handleChange} style={{ gridColumn: "span 2" }} />
          <input name="email" placeholder="אימייל" value={newUser.email} onChange={handleChange} style={{ gridColumn: "span 2" }} />
          <input name="password" type="password" placeholder="סיסמה" value={newUser.password} onChange={handleChange} style={{ gridColumn: "span 2" }} />
          <select name="role" value={newUser.role} onChange={handleChange} style={{ gridColumn: "span 2" }}>
            <option value="event_manager">מנהל אירוע</option>
            <option value="admin">מנהל מערכת</option>
            <option value="viewer">צופה</option>
          </select>
          <div style={{ gridColumn: "span 2", display: "flex", gap: 8 }}>
            <button onClick={handleAddUser} style={{ padding: "10px 14px", borderRadius: 8, border: "none", background: "#14b8a6", color: "#fff", cursor: "pointer" }}>שמור משתמש</button>
            <button onClick={() => setShowAddForm(false)} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>ביטול</button>
          </div>
        </div>
      )}

      <table border="1" style={{ width: "100%", marginBottom: 40 }}>
        <thead>
          <tr>
            <th>#</th>
            <th>שם משתמש</th>
            <th>שם מלא</th>
            <th>אימייל</th>
            <th>תפקיד</th>
            <th>🗑</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, idx) => (
            <tr key={u.id}>
              <td>{idx + 1}</td>
              <td>{u.username}</td>
              <td>{u.full_name}</td>
              <td>{u.email}</td>
              <td>{translateSystemRole(u.role)}</td>
              <td><button onClick={() => handleDelete(u.id)}>🗑</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>הרשאות משתמשים לאירוע</h3>
      <div style={{ marginBottom: 20 }}>
        <select name="user_id" value={newPerm.user_id} onChange={handlePermChange}>
          <option value="">בחר משתמש</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.full_name} ({u.username})</option>
          ))}
        </select>
        <select name="role_in_event" value={newPerm.role_in_event} onChange={handlePermChange}>
          <option value="event_admin">מנהל אירוע</option>
          <option value="viewer">צופה</option>
        </select>
        <button onClick={handleAddPerm}>➕ הוסף הרשאה</button>
      </div>
      <table border="1" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>#</th>
            <th>משתמש</th>
            <th>תפקיד</th>
            <th>🗑</th>
          </tr>
        </thead>
        <tbody>
          {permissions.map((p, idx) => {
            const user = users.find(u => u.id === p.user_id);
            return (
              <tr key={p.id}>
                <td>{idx + 1}</td>
                <td>{user ? user.full_name : p.user_id}</td>
                <td>
                  <select
                    value={p.role_in_event}
                    onChange={e => handleInlinePermChange(p.id, e.target.value)}
                  >
                    <option value="event_admin">מנהל אירוע</option>
                    <option value="viewer">צופה</option>
                  </select>
                </td>
                <td>
                  <button onClick={() => handleDeletePerm(p.id)}>🗑</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
