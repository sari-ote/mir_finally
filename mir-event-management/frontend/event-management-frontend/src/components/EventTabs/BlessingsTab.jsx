import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import "../../styles/theme-tropical.css";

export default function BlessingsTab({ eventId }) {
  const [blessings, setBlessings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [handledStatus, setHandledStatus] = useState({});

  useEffect(() => {
    const fetchBlessings = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://localhost:8001/greetings/event/${eventId}/list`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setBlessings(data);
          // Initialize handled status from data
          const initialHandled = {};
          data.forEach(b => {
            initialHandled[b.id] = b.is_handled || false;
          });
          setHandledStatus(initialHandled);
        } else {
          setError('שגיאה בטעינת הברכות');
        }
      } catch (err) {
        console.error('Error fetching blessings:', err);
        setError('שגיאה בטעינת הברכות');
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchBlessings();
    }
  }, [eventId]);

  const handleToggleHandled = async (blessingId) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`http://localhost:8001/greetings/${blessingId}/toggle-handled`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setHandledStatus(prev => ({
          ...prev,
          [blessingId]: !prev[blessingId]
        }));
      }
    } catch (err) {
      console.error('Error toggling handled status:', err);
    }
  };

  const handleDownloadFile = (filePath, fileName, eventId) => {
    if (!filePath) {
      console.error('No file path available. filePath:', filePath, 'fileName:', fileName);
      alert('הקובץ לא נשמר בשרת. רק שם הקובץ נשמר במערכת.');
      return;
    }
    
    // הנתיב כבר מכיל את uploads/ אז פשוט נוסיף את הנתיב המלא
    const fileUrl = `http://localhost:8001/${filePath}`;
    
    console.log('Opening file:', fileUrl, 'from path:', filePath);
    
    // פתיחת הקובץ בחלון חדש להצגה
    const newWindow = window.open(fileUrl, '_blank');
    
    // אם החלון נחסם, נציג הודעה
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      alert('חלון חדש נחסם. אנא אפשר חלונות קופצים בדפדפן.');
    }
  };

  // סינון ברכות לפי שם מוזמן
  const filteredBlessings = useMemo(() => {
    if (!searchValue.trim()) {
      return blessings;
    }
    
    const searchLower = searchValue.toLowerCase().trim();
    return blessings.filter((blessing) => {
      const fullName = blessing.guest_full_name || 
                       `${blessing.guest_first_name || ''} ${blessing.guest_last_name || ''}`.trim() || 
                       '';
      const firstName = (blessing.guest_first_name || '').toLowerCase();
      const lastName = (blessing.guest_last_name || '').toLowerCase();
      const fullNameLower = fullName.toLowerCase();
      
      return fullNameLower.includes(searchLower) || 
             firstName.includes(searchLower) || 
             lastName.includes(searchLower);
    });
  }, [blessings, searchValue]);

  if (loading) {
    return (
      <div style={{ direction: "rtl", padding: "20px", textAlign: "center" }}>
        <p>טוען ברכות...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ direction: "rtl", padding: "20px", textAlign: "center" }}>
        <p style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ direction: "rtl", padding: "20px" }}>
      <h3 style={{ textAlign: "center", marginBottom: "30px", color: "#2c3e50" }}>
        ברכות
      </h3>

      {/* פילטר חיפוש לפי שם */}
      {blessings.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: 20,
          background: '#fff',
          borderRadius: 6,
          padding: 12,
          border: '1px solid #e2e8f0',
          alignItems: 'flex-end'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 300 }}>
            <label style={{ fontWeight: 600, marginBottom: 6, color: '#1e293b', fontSize: 12 }}>
              חפש לפי שם מוזמן:
            </label>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="הקלד שם כדי לחפש..."
              className="tropical-input"
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 13,
                borderRadius: 4,
                border: '1px solid #cbd5e1',
              }}
            />
          </div>
          
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                borderRadius: 4,
                border: '1px solid #cbd5e1',
                background: '#f8f9fa',
                color: '#495057',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              נקה חיפוש
            </button>
          )}
        </div>
      )}

      {blessings.length === 0 ? (
        <div style={{
          backgroundColor: "#f8f9fa",
          border: "1px solid #e9ecef",
          borderRadius: "10px",
          padding: "40px",
          textAlign: "center",
          color: "#6c757d"
        }}>
          <p>אין ברכות עדיין</p>
        </div>
      ) : (
        <div style={{
          backgroundColor: "#fff",
          border: "1px solid #e9ecef",
          borderRadius: "8px",
          overflow: "hidden"
        }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            direction: "rtl"
          }}>
            <thead>
              <tr style={{
                backgroundColor: "#f8f9fa",
                borderBottom: "2px solid #e9ecef"
              }}>
                <th style={{
                  padding: "12px 16px",
                  textAlign: "right",
                  fontWeight: 600,
                  color: "#495057",
                  borderBottom: "2px solid #dee2e6"
                }}>
                  שם מוזמן
                </th>
                <th style={{
                  padding: "12px 16px",
                  textAlign: "right",
                  fontWeight: 600,
                  color: "#495057",
                  borderBottom: "2px solid #dee2e6"
                }}>
                  טלפון
                </th>
                <th style={{
                  padding: "12px 16px",
                  textAlign: "right",
                  fontWeight: 600,
                  color: "#495057",
                  borderBottom: "2px solid #dee2e6"
                }}>
                  תוכן הברכה
                </th>
                <th style={{
                  padding: "12px 16px",
                  textAlign: "right",
                  fontWeight: 600,
                  color: "#495057",
                  borderBottom: "2px solid #dee2e6"
                }}>
                  קובץ
                </th>
                <th style={{
                  padding: "12px 16px",
                  textAlign: "center",
                  fontWeight: 600,
                  color: "#495057",
                  borderBottom: "2px solid #dee2e6",
                  width: "80px"
                }}>
                  טופל
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredBlessings.length === 0 && searchValue ? (
                <tr>
                  <td colSpan={5} style={{
                    padding: "40px",
                    textAlign: "center",
                    color: "#6c757d"
                  }}>
                    לא נמצאו ברכות עבור "{searchValue}"
                  </td>
                </tr>
              ) : (
                filteredBlessings.map((blessing, index) => (
                <tr
                  key={blessing.id}
                  style={{
                    borderBottom: "1px solid #e9ecef",
                    backgroundColor: index % 2 === 0 ? "#fff" : "#f8f9fa",
                    transition: "background-color 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#e9ecef";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = index % 2 === 0 ? "#fff" : "#f8f9fa";
                  }}
                >
                  <td style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    color: "#212529"
                  }}>
                    {blessing.guest_full_name || 
                     `${blessing.guest_first_name || ''} ${blessing.guest_last_name || ''}`.trim() || 
                     'ללא שם'}
                  </td>
                  <td style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    color: "#212529"
                  }}>
                    {blessing.phone || 'ללא טלפון'}
                  </td>
                  <td style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    color: "#212529",
                    maxWidth: "400px",
                    wordBreak: "break-word"
                  }}>
                    <div
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word"
                      }}
                      dangerouslySetInnerHTML={{
                        __html: blessing.formatted_content || blessing.content || 'ללא תוכן'
                      }}
                    />
                  </td>
                  <td style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    color: "#212529"
                  }}>
                    {blessing.file_name ? (
                      blessing.file_path ? (
                        <a
                          href={`http://localhost:8001/${blessing.file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDownloadFile(blessing.file_path, blessing.file_name, eventId);
                          }}
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            cursor: "pointer",
                            color: "#007bff",
                            textDecoration: "underline",
                            display: "inline-block"
                          }}
                        >
                          {blessing.file_name}
                        </a>
                      ) : (
                        <span 
                          style={{ 
                            color: "#6c757d",
                            fontSize: "12px",
                            fontStyle: "italic"
                          }}
                          title="הקובץ לא נשמר בשרת (רק שם הקובץ נשמר)"
                        >
                          {blessing.file_name} (לא זמין)
                        </span>
                      )
                    ) : (
                      <span style={{ color: "#6c757d" }}>ללא קובץ</span>
                    )}
                  </td>
                  <td style={{
                    padding: "12px 16px",
                    textAlign: "center"
                  }}>
                    <input
                      type="checkbox"
                      checked={handledStatus[blessing.id] || false}
                      onChange={() => handleToggleHandled(blessing.id)}
                      style={{
                        width: "20px",
                        height: "20px",
                        cursor: "pointer",
                        accentColor: "#09b0cb"
                      }}
                    />
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

