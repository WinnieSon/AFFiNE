import { cssVar } from '@toeverything/theme';
import { keyframes, style } from '@vanilla-extract/css';

const pulse = keyframes({
  '0%': {
    opacity: 1,
  },
  '50%': {
    opacity: 0.5,
  },
  '100%': {
    opacity: 1,
  },
});

export const container = style({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: '8px',
  minHeight: '36px',
  userSelect: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
  
  ':hover': {
    backgroundColor: cssVar('hoverColor'),
  },
});

export const statusWrapper = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
});

export const statusIndicator = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

export const dot = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  transition: 'background-color 0.2s ease',
});

export const idle = style({
  backgroundColor: cssVar('textSecondaryColor'),
});

export const recording = style({
  backgroundColor: '#ff4444',
  animation: `${pulse} 2s infinite`,
});

export const textContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  flex: 1,
  minWidth: 0,
});

export const mainText = style({
  fontSize: '13px',
  fontWeight: 500,
  color: cssVar('textPrimaryColor'),
  lineHeight: '18px',
});

export const subText = style({
  fontSize: '11px',
  color: cssVar('textSecondaryColor'),
  lineHeight: '14px',
});