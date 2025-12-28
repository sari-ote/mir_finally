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
      <div className="scanner-header" style={{ textAlign: 'center', marginBottom: '24px', position: 'relative' }}>
        {/* Connection Status - Top Right */}
        <div style={{ 
          position: 'absolute',
          top: 0,
          right: 0,
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          padding: '6px 10px',
          background: isConnected ? 'var(--color-success, #22C55E)' : 'var(--color-error, #F97373)',
          color: 'white',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 500,
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'white',
            boxShadow: isConnected ? '0 0 0 0 rgba(255, 255, 255, 0.7)' : 'none',
            animation: isConnected ? 'pulse 2s infinite' : 'none',
          }}></div>
          <span>
            {isConnected ? 'מחובר' : 'מנותק'}
          </span>
        </div>
        <div style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(9, 176, 203, 0.1), rgba(11, 196, 224, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#09b0cb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
              <path d="M7 7h10M7 12h10M7 17h10"></path>
            </svg>
          </div>
        </div>
        <h3 className="tropical-section-title" style={{ marginBottom: '8px' }}>סריקת ברקוד QR</h3>
      </div>

      <div className="scanner-input-section" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ 
            width: 18,
            height: 18,
            borderRadius: 9,
            border: '2px solid rgba(148,163,184,0.8)'
          }} />
          <input
            type="text"
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="הקלד את הקוד כאן"
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {scanning ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <span>סורק...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                  <path d="M7 7h10M7 12h10M7 17h10"></path>
                </svg>
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
            <div style={{ 
              width: 32,
              height: 32,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: scanResult.type === 'success' 
                ? 'rgba(34, 197, 94, 0.1)' 
                : scanResult.type === 'warning'
                ? 'rgba(245, 158, 11, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
              flexShrink: 0
            }}>
              {scanResult.type === 'success' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : scanResult.type === 'warning' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: '8px' }}>{scanResult.message}</div>
              {scanResult.guest && (
                <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{scanResult.guest.name}</div>
                  {scanResult.hasSeating ? (
                    <div className="tropical-badge tropical-badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      <span>יש מקום ישיבה</span>
                    </div>
                  ) : (
                    <div className="tropical-badge tropical-badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
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

    </div>
  );
};

export default QRCodeScanner; 