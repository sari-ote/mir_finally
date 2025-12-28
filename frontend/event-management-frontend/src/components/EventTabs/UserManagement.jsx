import React, { useState, useEffect } from "react";
import "../../styles/theme-tropical.css";
import TrashIcon from "../ui/TrashIcon";
import EditIcon from "../ui/EditIcon";
import CheckIcon from "../ui/CheckIcon";
import UserIcon from "../ui/UserIcon";

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
  const [editUserId, setEditUserId] = useState(null);
  const [editUser, setEditUser] = useState({
    username: "",
    full_name: "",
    email: "",
    password: "",
    role: "event_manager"
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [deleteUserName, setDeleteUserName] = useState("");
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [deletedUserName, setDeletedUserName] = useState("");
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false);
  const [updatedUserName, setUpdatedUserName] = useState("");
  const [newPerm, setNewPerm] = useState({ user_id: "", role_in_event: "" });
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
    if (!newUser.username || !newUser.full_name || !newUser.password) {
      alert("יש למלא את כל השדות הנדרשים");
      return;
    }
    const payload = {
      username: newUser.username,
      full_name: newUser.full_name,
      email: newUser.email,
      password: newUser.password,
      role: newUser.role,
      id_number: null // id_number is optional
    };
    console.log("Adding user:", payload);
    fetch("http://localhost:8001/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
      .then(async res => {
        console.log("Add user response status:", res.status);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ detail: res.statusText }));
          console.error("Add user error:", errorData);
          throw new Error(errorData.detail || `שגיאה בהוספה (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("User added successfully:", data);
        setNewUser({ username: "", full_name: "", email: "", password: "", role: "event_manager" });
        setShowAddForm(false);
        fetchUsers();
      })
      .catch(err => {
        console.error("Error adding user:", err);
        alert(err.message || "שגיאה בהוספת המשתמש. בדוק שהשרת רץ על פורט 8001");
      });
  };

  const handleDelete = (id, userName) => {
    setDeleteUserId(id);
    setDeleteUserName(userName);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!deleteUserId) return;
    const userNameToDelete = deleteUserName;
    fetch(`http://localhost:8001/users/${deleteUserId}`, { 
      method: "DELETE", 
      headers: { Authorization: `Bearer ${token}` } 
    })
      .then(() => {
        fetchUsers();
        setShowDeleteConfirm(false);
        setDeleteUserId(null);
        setDeleteUserName("");
        // Show success popup
        setDeletedUserName(userNameToDelete);
        setShowDeleteSuccess(true);
        // Auto close after 3 seconds
        setTimeout(() => {
          setShowDeleteSuccess(false);
          setDeletedUserName("");
        }, 3000);
      })
      .catch(err => {
        alert("שגיאה במחיקה: " + err.message);
        setShowDeleteConfirm(false);
        setDeleteUserId(null);
        setDeleteUserName("");
      });
  };

  const handleEditUser = (user) => {
    setEditUserId(user.id);
    setEditUser({
      username: user.username || "",
      full_name: user.full_name || "",
      email: user.email || "",
      password: "", // Don't pre-fill password
      role: user.role || "event_manager"
    });
    setShowAddForm(false);
  };

  const handleUpdateUser = () => {
    if (!isValidEmail(editUser.email)) {
      alert("אימייל לא תקין");
      return;
    }
    const payload = { ...editUser };
    const userNameToUpdate = editUser.full_name || editUser.username;
    // Don't send password if it's empty
    if (!payload.password || payload.password.trim() === "") {
      delete payload.password;
    }
    console.log("Updating user:", editUserId, payload);
    fetch(`http://localhost:8001/users/${editUserId}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json", 
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(payload),
    })
      .then(async res => {
        console.log("Update response status:", res.status);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ detail: res.statusText }));
          console.error("Update error:", errorData);
          throw new Error(errorData.detail || `שגיאה בעדכון (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("Update successful:", data);
        setEditUserId(null);
        setEditUser({ username: "", full_name: "", email: "", password: "", role: "event_manager" });
        fetchUsers();
        // Show success popup
        setUpdatedUserName(userNameToUpdate);
        setShowUpdateSuccess(true);
        // Auto close after 3 seconds
        setTimeout(() => {
          setShowUpdateSuccess(false);
          setUpdatedUserName("");
        }, 3000);
      })
      .catch(err => {
        console.error("Error updating user:", err);
        alert(err.message || "שגיאה בעדכון המשתמש. בדוק שהשרת רץ על פורט 8001");
      });
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
    <div
      className="theme-tropical"
      style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div
        style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          marginBottom: 4
        }}
      >
        <h2
          style={{ 
            margin: 0, 
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "var(--color-text-main, #10131A)",
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}
        >
          ניהול משתמשים
        </h2>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          style={{
            padding: "8px 16px",
            borderRadius: 12,
            border: "none",
            background: showAddForm 
              ? "var(--color-border-light, #E1E5EC)" 
              : "var(--color-primary, #09b0cb)",
            color: showAddForm 
              ? "var(--color-text-secondary, #6b7280)" 
              : "white",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          {showAddForm ? (
            "בטל"
          ) : (
            <>
              <UserIcon size={18} color="currentColor" />
              הוסף משתמש
            </>
          )}
        </button>
      </div>

      {editUserId && (
        <div style={{
          background: "var(--color-surface, #FFFFFF)",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: 16
        }}>
          <h3 style={{
            margin: "0 0 16px 0",
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--color-text-main, #10131A)",
            fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          }}>
            עריכת משתמש
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input
                name="username"
                placeholder="שם משתמש"
                value={editUser.username}
                onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  fontSize: "0.875rem",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                }}
              />
              <input
                name="full_name"
                placeholder="שם מלא"
                value={editUser.full_name}
                onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  fontSize: "0.875rem",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                }}
              />
              <input
                name="email"
                placeholder="אימייל"
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  fontSize: "0.875rem",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                }}
              />
              <input
                name="password"
                type="password"
                placeholder="סיסמה חדשה (השאר ריק אם לא רוצה לשנות)"
                value={editUser.password}
                onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  fontSize: "0.875rem",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                }}
              />
              <select
                name="role"
                value={editUser.role}
                onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                className="tropical-input"
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  fontSize: "0.875rem",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  background: "white"
                }}
              >
                <option value="event_manager">מנהל אירוע</option>
                <option value="viewer">צופה</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-start" }}>
              <button
                onClick={handleUpdateUser}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: "var(--color-primary, #09b0cb)",
                  color: "white",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                עדכן
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditUserId(null);
                  setEditUser({ username: "", full_name: "", email: "", password: "", role: "event_manager" });
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  background: "transparent",
                  color: "var(--color-text-secondary, #6b7280)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div style={{
          background: "var(--color-surface, #FFFFFF)",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input
                name="username"
                placeholder="שם משתמש"
                value={newUser.username}
                onChange={handleChange}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  fontSize: "0.875rem",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                }}
              />
              <input
                name="full_name"
                placeholder="שם מלא"
                value={newUser.full_name}
                onChange={handleChange}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  fontSize: "0.875rem",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                }}
              />
              <input
                name="email"
                placeholder="אימייל"
                value={newUser.email}
                onChange={handleChange}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  fontSize: "0.875rem",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                }}
              />
              <input
                name="password"
                type="password"
                placeholder="סיסמה"
                value={newUser.password}
                onChange={handleChange}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  fontSize: "0.875rem",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                }}
              />
              <select
                name="role"
                value={newUser.role}
                onChange={handleChange}
                className="tropical-input"
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  fontSize: "0.875rem",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  background: "white"
                }}
              >
                <option value="event_manager">מנהל אירוע</option>
                <option value="viewer">צופה</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-start" }}>
              <button
                onClick={handleAddUser}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: "var(--color-primary, #09b0cb)",
                  color: "white",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                שמור
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "1px solid var(--color-border-light, #E1E5EC)",
                  background: "transparent",
                  color: "var(--color-text-secondary, #6b7280)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        background: "var(--color-surface, #FFFFFF)",
        borderRadius: 16,
        padding: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
      }}>
        <h3 style={{
          margin: "0 0 12px 0",
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--color-text-main, #10131A)",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        }}>
          משתמשים במערכת
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.8125rem"
          }}>
            <thead>
              <tr style={{
                textAlign: "right",
                borderBottom: "1px solid var(--color-border-light, #E1E5EC)",
                color: "var(--color-text-tertiary, #9CA3AF)",
                fontSize: "0.75rem",
                fontWeight: 600
              }}>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>#</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>שם משתמש</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>שם מלא</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>אימייל</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>תפקיד</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, idx) => (
                <tr key={u.id} style={{
                  borderBottom: "1px solid var(--color-border-light, #E1E5EC)",
                  transition: "background 0.15s ease"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-primary-ultra-soft, #F0FDFF)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "10px 12px", color: "var(--color-text-tertiary, #9CA3AF)" }}>{idx + 1}</td>
                  <td style={{ padding: "10px 12px", color: "var(--color-text-main, #10131A)" }}>{u.username}</td>
                  <td style={{ padding: "10px 12px", color: "var(--color-text-main, #10131A)" }}>{u.full_name}</td>
                  <td style={{ padding: "10px 12px", color: "var(--color-text-secondary, #6b7280)", fontSize: "0.8125rem" }}>{u.email}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: "var(--color-primary-ultra-soft, #F0FDFF)",
                      color: "var(--color-primary-dark, #067a8a)",
                      fontSize: "0.75rem",
                      fontWeight: 600
                    }}>
                      {translateSystemRole(u.role)}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        onClick={() => handleEditUser(u)}
                        style={{
                          padding: "6px",
                          borderRadius: 8,
                          border: "none",
                          background: "transparent",
                          color: "var(--color-primary, #09b0cb)",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 28,
                          height: 28
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(9, 176, 203, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                        title="ערוך"
                      >
                        <EditIcon size={16} color="var(--color-primary, #09b0cb)" />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.full_name || u.username)}
                        style={{
                          padding: "6px",
                          borderRadius: 8,
                          border: "none",
                          background: "transparent",
                          color: "var(--color-error, #ef4444)",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 28,
                          height: 28
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                        title="מחק"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--color-text-tertiary, #9CA3AF)", fontSize: "0.875rem" }}>
                    אין משתמשים עדיין
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{
        background: "var(--color-surface, #FFFFFF)",
        borderRadius: 16,
        padding: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
      }}>
        <h3 style={{
          margin: "0 0 12px 0",
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--color-text-main, #10131A)",
                  fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        }}>
          הגדרת הרשאות משתמשים לאירוע
        </h3>

        <div style={{
          display: "flex",
          flexWrap: "nowrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}>
          <select
            name="user_id"
            value={newPerm.user_id}
            onChange={handlePermChange}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid var(--color-border-light, #E1E5EC)",
              fontSize: "0.8125rem",
              fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              background: "white",
              minWidth: 180
            }}
          >
            <option value="">בחר משתמש</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.username})
              </option>
            ))}
          </select>
          <select
            name="role_in_event"
            value={newPerm.role_in_event}
            onChange={handlePermChange}
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid var(--color-border-light, #E1E5EC)",
              fontSize: "0.8125rem",
              fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              background: "white",
              minWidth: 140
            }}
          >
            <option value="">בחר תפקיד</option>
            <option value="event_admin">מנהל אירוע</option>
            <option value="viewer">צופה</option>
          </select>
          <button
            onClick={handleAddPerm}
            style={{
              padding: "8px 16px",
              borderRadius: 12,
              border: "none",
              background: "var(--color-primary, #09b0cb)",
              color: "white",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap"
            }}
          >
            הוסף
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.8125rem"
          }}>
            <thead>
              <tr style={{
                textAlign: "right",
                borderBottom: "1px solid var(--color-border-light, #E1E5EC)",
                color: "var(--color-text-tertiary, #9CA3AF)",
                fontSize: "0.75rem",
                fontWeight: 600
              }}>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>#</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>משתמש</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>תפקיד באירוע</th>
                <th style={{ padding: "8px 12px", fontWeight: 600 }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p, idx) => {
                const user = users.find((u) => u.id === p.user_id);
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: "1px solid var(--color-border-light, #E1E5EC)",
                      transition: "background 0.15s ease"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--color-primary-ultra-soft, #F0FDFF)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "10px 12px", color: "var(--color-text-tertiary, #9CA3AF)" }}>{idx + 1}</td>
                    <td style={{ padding: "10px 12px", color: "var(--color-text-main, #10131A)" }}>{user ? user.full_name : p.user_id}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <select
                        value={p.role_in_event}
                        onChange={(e) => handleInlinePermChange(p.id, e.target.value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--color-border-light, #E1E5EC)",
                          fontSize: "0.75rem",
                          fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                          background: "white",
                          minWidth: 140
                        }}
                      >
                        <option value="event_admin">מנהל אירוע</option>
                        <option value="viewer">צופה</option>
                      </select>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        onClick={() => handleDeletePerm(p.id)}
                        style={{
                          padding: "6px",
                          borderRadius: 8,
                          border: "none",
                          background: "transparent",
                          color: "var(--color-error, #ef4444)",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 28,
                          height: 28
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                        title="מחק"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {permissions.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "var(--color-text-tertiary, #9CA3AF)", fontSize: "0.875rem" }}>
                    אין הרשאות משויכות כרגע לאירוע
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          onClick={() => {
            setShowDeleteConfirm(false);
            setDeleteUserId(null);
            setDeleteUserName("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="theme-tropical"
            style={{
              background: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "24px",
              padding: "32px",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.25), 0 4px 16px rgba(0, 0, 0, 0.15)",
              border: "1px solid rgba(225, 229, 236, 0.8)",
              maxWidth: "480px",
              width: "90%",
              direction: "rtl"
            }}
          >
            <div style={{ 
              display: "flex", 
              justifyContent: "center",
              marginBottom: 20 
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <TrashIcon size={24} color="var(--color-error, #ef4444)" />
              </div>
            </div>
            <p
              style={{
                margin: "0 0 24px 0",
                fontSize: "1rem",
                color: "var(--color-text-secondary, #6B7280)",
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                lineHeight: 1.6
              }}
            >
              האם אתה בטוח שברצונך למחוק את המשתמש <strong style={{ color: "var(--color-text-main, #10131A)" }}>{deleteUserName}</strong>?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-start" }}>
              <button
                onClick={confirmDelete}
                className="tropical-button-primary"
                style={{
                  padding: "12px 24px",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  minWidth: "120px"
                }}
              >
                אישור
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteUserId(null);
                  setDeleteUserName("");
                }}
                className="tropical-button-secondary"
                style={{
                  padding: "12px 24px",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  minWidth: "120px"
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Success Modal */}
      {showDeleteSuccess && (
        <div
          onClick={() => {
            setShowDeleteSuccess(false);
            setDeletedUserName("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="theme-tropical"
            style={{
              background: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "24px",
              padding: "32px",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.25), 0 4px 16px rgba(0, 0, 0, 0.15)",
              border: "1px solid rgba(225, 229, 236, 0.8)",
              maxWidth: "400px",
              width: "90%",
              direction: "rtl",
              textAlign: "center"
            }}
          >
            <div style={{ 
              display: "flex", 
              justifyContent: "center",
              marginBottom: 20 
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(34, 197, 94, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <CheckIcon size={32} color="var(--color-success, #22c55e)" />
              </div>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "1.1rem",
                color: "var(--color-text-main, #10131A)",
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                lineHeight: 1.6,
                fontWeight: 500
              }}
            >
              משתמש <strong style={{ color: "var(--color-text-main, #10131A)" }}>{deletedUserName}</strong> נמחק בהצלחה
            </p>
          </div>
        </div>
      )}

      {/* Update Success Modal */}
      {showUpdateSuccess && (
        <div
          onClick={() => {
            setShowUpdateSuccess(false);
            setUpdatedUserName("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="theme-tropical"
            style={{
              background: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "24px",
              padding: "32px",
              boxShadow: "0 16px 40px rgba(15, 23, 42, 0.25), 0 4px 16px rgba(0, 0, 0, 0.15)",
              border: "1px solid rgba(225, 229, 236, 0.8)",
              maxWidth: "400px",
              width: "90%",
              direction: "rtl",
              textAlign: "center"
            }}
          >
            <div style={{ 
              display: "flex", 
              justifyContent: "center",
              marginBottom: 20 
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "rgba(9, 176, 203, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <EditIcon size={32} color="var(--color-primary, #09b0cb)" />
              </div>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "1.1rem",
                color: "var(--color-text-main, #10131A)",
                fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                lineHeight: 1.6,
                fontWeight: 500
              }}
            >
              משתמש <strong style={{ color: "var(--color-text-main, #10131A)" }}>{updatedUserName}</strong> עודכן בהצלחה
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
