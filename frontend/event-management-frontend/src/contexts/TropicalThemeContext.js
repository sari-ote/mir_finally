import React, { createContext, useContext, useState, useEffect } from 'react';

const TropicalThemeContext = createContext(undefined);

export function TropicalThemeProvider({ children }) {
  const [isTropicalEnabled, setIsTropicalEnabled] = useState(() => {
    // Always default to true (tropical theme enabled by default)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tropical-theme-enabled');
      // If no preference saved, default to true
      if (saved === null) {
        return true;
      }
      // Respect user's saved preference
      return saved === 'true';
    }
    // Default to true (tropical theme enabled)
    return true;
  });

  useEffect(() => {
    // Save preference to localStorage
    localStorage.setItem('tropical-theme-enabled', isTropicalEnabled.toString());
    
    // Apply/remove class on body and html for global control
    if (isTropicalEnabled) {
      document.body.classList.add('tropical-theme-active');
      document.body.classList.add('theme-tropical');
      document.documentElement.classList.add('theme-tropical');
    } else {
      document.body.classList.remove('tropical-theme-active');
      document.body.classList.remove('theme-tropical');
      document.documentElement.classList.remove('theme-tropical');
    }
  }, [isTropicalEnabled]);

  const toggleTropical = () => {
    setIsTropicalEnabled(prev => !prev);
  };

  const enableTropical = () => {
    setIsTropicalEnabled(true);
  };

  const disableTropical = () => {
    setIsTropicalEnabled(false);
  };

  const value = {
    isTropicalEnabled,
    toggleTropical,
    enableTropical,
    disableTropical,
  };

  return (
    <TropicalThemeContext.Provider value={value}>
      {children}
    </TropicalThemeContext.Provider>
  );
}

export function useTropicalTheme() {
  const context = useContext(TropicalThemeContext);
  if (context === undefined) {
    throw new Error('useTropicalTheme must be used within a TropicalThemeProvider');
  }
  return context;
}

