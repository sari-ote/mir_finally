import React, { useState, useEffect } from 'react';
import './QRCodeScanner.css';
import '../styles/theme-tropical.css';

const QRCodeScanner = ({ eventId, onScan }) => {
  const [scanning, setScanning] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const handleScan = async () => {
    if (!qrCode.trim()) return;
    
    setScanning(true);
    setScanResult(null);
    
    const requestData = {
      qr_code: qrCode,
      event_id: eventId
    };
    
    console.log('Sending scan request:', requestData);
    console.log('QR Code being scanned:', qrCode);
    console.log('Event ID:', eventId);
    
    try {
      const response = await fetch('http://localhost:8001/realtime/scan-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Scan result:', result);
      console.log('Guest details:', result.guest);
      console.log('Has seating:', result.has_seating);
      
      if (result.status === 'success') {
        setScanResult({
          type: 'success',
          message: result.message,
          guest: result.guest,
          hasSeating: result.has_seating
        });
        onScan && onScan(result);
        setQrCode('');
        
        // לא מרעננים את כל העמוד כדי לשמור על הטאב הנוכחי.
        // ה-RealTimeDashboard כבר מאזין ל-WebSocket ומרענן נתונים דרך loadData()
      } else {
        console.log('Scan failed with status:', result.status);
        console.log('Error message:', result.message);
        setScanResult({
          type: 'warning',
          message: result.message
        });
      }
    } catch (error) {
      console.error('Scan error:', error);
      setScanResult({
        type: 'error',
        message: `שגיאה בסריקת הברקוד: ${error.message}`
      });
    } finally {
      setScanning(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const clearResult = () => {
    setScanResult(null);
  };

  useEffect(() => {
    if (scanResult) {
      const timer = setTimeout(clearResult, 5000);
      return () => clearTimeout(timer);
    }
  }, [scanResult]);

  return (
    <div className="tropical-card" style={{ 
      maxWidth: '600px', 
      margin: '20px auto',
      padding: '32px',
    }}>
      <div className="scanner-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📱</div>
        <h3 className="tropical-section-title" style={{ marginBottom: '8px' }}>סריקת ברקוד QR</h3>
        <div className="tropical-subtitle">הכנס קוד QR או סרוק ברקוד</div>
      </div>

      <div className="scanner-input-section" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '20px', opacity: 0.7 }}>🔍</div>
          <input
            type="text"
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="הכנס קוד QR כאן..."
            className="tropical-input"
            disabled={scanning}
            style={{ flex: 1 }}
          />
          <button 
            onClick={handleScan}
            disabled={scanning || !qrCode.trim()}
            className="tropical-button-primary"
            style={{
              width: 'auto',
              minWidth: '120px',
            }}
          >
            {scanning ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: '8px' }}></div>
                <span>סורק...</span>
              </>
            ) : (
              <>
                <span style={{ marginRight: '8px' }}>📷</span>
                <span>סרוק</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scan Result */}
      {scanResult && (
        <div className={`tropical-alert ${scanResult.type === 'success' ? 'tropical-alert-success' : scanResult.type === 'warning' ? 'tropical-alert-warning' : 'tropical-alert-error'}`} style={{ 
          position: 'relative',
          marginTop: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ fontSize: '24px' }}>
              {scanResult.type === 'success' ? '✅' : 
               scanResult.type === 'warning' ? '⚠️' : '❌'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>{scanResult.message}</div>
              {scanResult.guest && (
                <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{scanResult.guest.name}</div>
                  {scanResult.hasSeating ? (
                    <div className="tropical-badge tropical-badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>📍</span>
                      <span>יש מקום ישיבה</span>
                    </div>
                  ) : (
                    <div className="tropical-badge tropical-badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>⚠️</span>
                      <span>ללא מקום ישיבה</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={clearResult} className="tropical-button-ghost" style={{ padding: '4px 8px', minWidth: 'auto', fontSize: '18px' }}>×</button>
          </div>
        </div>
      )}

      {/* Scanner Tips */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px', 
        marginTop: '24px',
        padding: '16px',
        background: 'var(--color-primary-ultra-soft, #F0FDFF)',
        borderRadius: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '20px' }}>💡</div>
          <div className="tropical-subtitle" style={{ margin: 0 }}>הקלד את הקוד או השתמש בסורק ברקוד</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '20px' }}>⚡</div>
          <div className="tropical-subtitle" style={{ margin: 0 }}>התראות יופיעו מיד כשמוזמן ייכנס</div>
        </div>
      </div>

      {/* Connection Status */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginTop: '20px',
        padding: '12px 16px',
        background: isConnected ? 'var(--color-success, #22C55E)' : 'var(--color-error, #F97373)',
        color: 'white',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: 500,
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'white',
          boxShadow: isConnected ? '0 0 0 0 rgba(255, 255, 255, 0.7)' : 'none',
          animation: isConnected ? 'pulse 2s infinite' : 'none',
        }}></div>
        <span>
          {isConnected ? 'מחובר למערכת זמן אמת' : 'מנותק מהמערכת'}
        </span>
      </div>
    </div>
  );
};

export default QRCodeScanner; 