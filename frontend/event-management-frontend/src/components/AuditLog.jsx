import React, { useEffect, useState } from "react";
import "../styles/theme-tropical.css";

export default function AuditLog({ eventId }) {
  const [logs, setLogs] = useState([]);

  console.log('AuditLog: Component rendered with eventId:', eventId);

  const fetchLogs = () => {
    if (!eventId) {
      console.log('AuditLog: No eventId, returning');
      return;
    }
    let url = `http://localhost:8001/audit-log/all?event_id=${eventId}`;
    console.log('AuditLog: Fetching from URL:', url);
    const token = localStorage.getItem('access_token');
    console.log('AuditLog: Token exists:', !!token);
    fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => {
        console.log('AuditLog: Response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('AuditLog: Received data:', data);
        console.log('AuditLog: Data is array:', Array.isArray(data));
        console.log('AuditLog: Data length:', data?.length);
        setLogs(Array.isArray(data) ? data : []);
      })
      .catch(error => {
        console.error('AuditLog: Fetch error:', error);
      });
  };

  useEffect(() => {
    console.log('AuditLog: useEffect triggered with eventId:', eventId);
    fetchLogs();
    
    // רענון אוטומטי כל 5 שניות
    const interval = setInterval(fetchLogs, 5000);
    
    return () => clearInterval(interval);
  }, [eventId]);

  console.log('AuditLog: Current logs state:', logs);
  console.log('AuditLog: Logs length:', logs.length);

  if (!eventId) {
    console.log('AuditLog: No eventId, returning null');
    return null;
  }

  return (
    <div className="theme-tropical" style={{ 
      background: "var(--color-surface, #FFFFFF)", 
      borderRadius: "12px", 
      padding: "20px", 
      maxHeight: 500, 
      overflowY: "auto" 
    }}>
      <h4 className="tropical-section-title" style={{ 
        marginBottom: "16px", 
        fontSize: "1.1rem",
        color: "var(--color-text-main, #10131A)",
      }}>
        <span 
          className="tropical-icon tropical-icon-primary" 
          style={{ 
            marginLeft: "8px",
            width: 16,
            height: 16,
            borderRadius: 999,
            border: "2px solid currentColor",
            display: "inline-block"
          }} 
        />
        היסטוריית שינויים לאירוע {eventId}
      </h4>
      {logs.length === 0 ? (
        <div style={{ 
          color: "var(--color-text-tertiary, #9CA3AF)", 
          textAlign: "center",
          padding: "32px",
        }}>
          <div 
            style={{ 
              width: 28,
              height: 28,
              borderRadius: 9,
              border: "2px solid rgba(148,163,184,0.6)",
              marginBottom: "8px"
            }} 
          />
          <div className="tropical-subtitle">אין שינויים</div>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {logs.map(log => {
            let actionText = "";
            let detailsText = "";
            let actionIcon = "◯";
            let actionBadgeClass = "tropical-badge-primary";
            
            if (log.action === "create") {
              actionIcon = "✓";
              actionBadgeClass = "tropical-badge-success";
              if (log.entity_type === "Table") {
                if (log.field === "bulk_create") {
                  actionText = "הוספת שולחנות";
                  detailsText = log.new_value;
                } else {
                  actionText = "הוספת שולחן";
                  detailsText = log.new_value;
                }
              } else {
                actionText = "סידור מקומות";
                detailsText = log.new_value;
              }
            } else if (log.action === "delete") {
              actionIcon = "✕";
              actionBadgeClass = "tropical-badge-error";
              if (log.entity_type === "Table") {
                if (log.field === "bulk_delete") {
                  actionText = "מחיקת שולחנות";
                  detailsText = log.old_value;
                } else {
                  actionText = "מחיקת שולחן";
                  detailsText = log.old_value;
                }
              } else {
                actionText = "מחיקה";
                detailsText = log.old_value;
              }
            } else if (log.action === "update") {
              actionIcon = "◐";
              actionBadgeClass = "tropical-badge-warning";
              actionText = "העברת  בין שולחנות";
              detailsText = `${log.field}: ${log.old_value} → ${log.new_value}`;
            }
            return (
              <li key={log.id} style={{ 
                marginBottom: "16px", 
                borderBottom: "1px solid var(--color-border-light, #E1E5EC)", 
                paddingBottom: "12px",
                padding: "12px",
                borderRadius: "8px",
                background: "var(--color-primary-ultra-soft, #F0FDFF)",
              }}>
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "8px", 
                  marginBottom: "8px" 
                }}>
                  <span className="tropical-icon" style={{ fontSize: "14px" }}>{actionIcon}</span>
                  <span className={`tropical-badge ${actionBadgeClass}`} style={{ fontSize: "11px" }}>
                    {actionText}
                  </span>
                </div>
                <div style={{ 
                  color: "var(--color-text-secondary, #6B7280)", 
                  fontSize: "14px", 
                  marginBottom: "8px",
                  paddingRight: "20px",
                }}>
                  {detailsText}
                </div>
                <div style={{ 
                  fontSize: "12px", 
                  color: "var(--color-text-tertiary, #9CA3AF)",
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}>
                  <span className="tropical-badge" style={{ 
                    fontSize: "10px",
                    padding: "4px 8px",
                    background: "rgba(0,0,0,0.05)",
                  }}>
                    {log.timestamp && new Date(log.timestamp).toLocaleString("he-IL", {
                      timeZone: "Asia/Jerusalem",
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                  <span className="tropical-badge" style={{ 
                    fontSize: "10px",
                    padding: "4px 8px",
                    background: "rgba(0,0,0,0.05)",
                  }}>
                    ע"י: {log.user_name || log.user_id || "לא ידוע"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
} 