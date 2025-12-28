import React, { createContext, useContext, useState, useEffect } from 'react';

const TropicalThemeContext = createContext(undefined);

export function TropicalThemeProvider({ children }) {
  const [isTropicalEnabled, setIsTropicalEnabled] = useState(() => {
    // Check localStorage for saved preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tropical-theme-enabled');
      return saved === 'true';
    }
    return false;
  });

  useEffect(() => {
    // Save preference to localStorage
    localStorage.setItem('tropical-theme-enabled', isTropicalEnabled.toString());
    
    // Apply/remove class on body for global control
    if (isTropicalEnabled) {
      document.body.classList.add('tropical-theme-active');
    } else {
      document.body.classList.remove('tropical-theme-active');
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

