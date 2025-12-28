import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTropicalTheme } from '../contexts/TropicalThemeContext';
import '../styles/theme-tropical.css';

function TropicalThemeToggle() {
  const { isTropicalEnabled, toggleTropical } = useTropicalTheme();
  const location = useLocation();
  
  // Don't show on login page
  if (location.pathname === '/' || location.pathname === '/login') {
    return null;
  }

  return (
    <button
      onClick={toggleTropical}
      className={isTropicalEnabled ? 'theme-tropical' : ''}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        padding: '12px 20px',
        borderRadius: '999px',
        border: isTropicalEnabled ? '2px solid var(--color-primary, #09b0cb)' : '2px solid #e1e5ec',
        backgroundColor: isTropicalEnabled ? 'var(--color-primary-soft, #E0F7FA)' : '#ffffff',
        color: isTropicalEnabled ? 'var(--color-primary-dark, #067a8a)' : '#6b7280',
        fontSize: '0.875rem',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: isTropicalEnabled 
          ? '0 4px 12px rgba(9, 176, 203, 0.25)' 
          : '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
      onMouseEnter={(e) => {
        if (isTropicalEnabled) {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(9, 176, 203, 0.35)';
        } else {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = isTropicalEnabled 
          ? '0 4px 12px rgba(9, 176, 203, 0.25)' 
          : '0 4px 12px rgba(0, 0, 0, 0.15)';
      }}
      title={isTropicalEnabled ? 'כבה עיצוב טרופי' : 'הפעל עיצוב טרופי'}
    >
      <span style={{ fontSize: '1.2em' }}>{isTropicalEnabled ? '◉' : '◯'}</span>
      {isTropicalEnabled ? 'עיצוב טרופי פעיל' : 'עיצוב טרופי'}
    </button>
  );
}

export default TropicalThemeToggle;

