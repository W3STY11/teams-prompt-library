/**
 * Glass morphism theme utilities for Teams Prompt Library
 * Provides consistent glass effect styling across the application
 */

export const gradients = {
  light: 'linear-gradient(135deg,#e3f2fd 0%,#bbdefb 50%,#90caf9 100%)',
  dark:  'linear-gradient(135deg,#0d1b2a 0%,#1b263b 50%,#2d3e50 100%)',
};

export const glass = {
  card: {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(12px) saturate(180%)',
    WebkitBackdropFilter: 'blur(12px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.40)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.12)',
    transition:
      'transform 150ms cubic-bezier(0.1,0.9,0.2,1), box-shadow 150ms cubic-bezier(0.1,0.9,0.2,1), background 150ms cubic-bezier(0.1,0.9,0.2,1), border-color 150ms cubic-bezier(0.1,0.9,0.2,1)',
    ':hover': {
      transform: 'translateY(-4px)',
      background: 'rgba(255,255,255,0.78)',
      border: '1px solid rgba(255,255,255,0.55)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.16), 0 0 4px rgba(0,0,0,0.14)',
    },
  },
  cardDark: {
    background: 'rgba(13,27,42,0.60)',
    border: '1px solid rgba(255,255,255,0.20)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.40), 0 0 2px rgba(0,0,0,0.30)',
    ':hover': {
      background: 'rgba(13,27,42,0.66)',
      border: '1px solid rgba(255,255,255,0.28)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.48), 0 0 4px rgba(0,0,0,0.36)',
    },
  },
  header: {
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderBottom: '1px solid rgba(255,255,255,0.40)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.14), 0 0 2px rgba(0,0,0,0.12)',
  },
  headerDark: {
    background: 'rgba(13,27,42,0.72)',
    borderBottom: '1px solid rgba(255,255,255,0.20)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.50), 0 0 2px rgba(0,0,0,0.42)',
  },
  band: {
    background: 'rgba(255,255,255,0.60)',
    backdropFilter: 'blur(12px) saturate(180%)',
    WebkitBackdropFilter: 'blur(12px) saturate(180%)',
    borderTop: '1px solid rgba(255,255,255,0.40)',
    borderBottom: '1px solid rgba(255,255,255,0.40)',
  },
  bandDark: {
    background: 'rgba(13,27,42,0.56)',
    borderTop: '1px solid rgba(255,255,255,0.20)',
    borderBottom: '1px solid rgba(255,255,255,0.20)',
  },
};
