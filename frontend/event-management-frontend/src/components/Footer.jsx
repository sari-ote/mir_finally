import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import '../styles/theme-tropical.css';

export default function Footer() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Don't show footer on login page or public pages
  if (location.pathname === "/" || 
      location.pathname === "/login" || 
      location.pathname.startsWith("/public")) {
    return null;
  }

  return (
    <footer 
      className="theme-tropical"
      style={{
        position: "relative",
        width: "100%",
        padding: isMobile ? "8px 12px" : "16px 24px",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(225, 229, 236, 0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.05)",
        marginTop: "auto",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: isMobile ? "0.65rem" : "0.875rem",
          color: "var(--color-text-secondary, #6B7280)",
          fontFamily: "'Rubik', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontWeight: 400,
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        Designed & Developed by <strong style={{ color: "var(--color-primary, #09b0cb)", fontWeight: 600 }}>O.T.E.</strong>
      </p>
    </footer>
  );
}

