import React from 'react';
import { useTropicalTheme } from '../contexts/TropicalThemeContext';
import '../styles/theme-tropical.css';

/**
 * Wrapper component that applies tropical theme to its children
 * Only applies the theme if tropical theme is enabled globally
 * 
 * Usage:
 * <TropicalWrapper>
 *   <YourComponent />
 * </TropicalWrapper>
 */
function TropicalWrapper({ children, className = '', force = false }) {
  const { isTropicalEnabled } = useTropicalTheme();
  
  // If force is true, always apply theme (for testing specific components)
  const shouldApplyTheme = force || isTropicalEnabled;
  
  return (
    <div className={shouldApplyTheme ? `theme-tropical ${className}` : className}>
      {children}
    </div>
  );
}

export default TropicalWrapper;

