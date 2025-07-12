import { cssVar } from '@toeverything/theme';
import { keyframes, style } from '@vanilla-extract/css';

const pulse = keyframes({
  '0%': {
    opacity: 1,
    transform: 'scale(1)',
  },
  '50%': {
    opacity: 0.7,
    transform: 'scale(1.1)',
  },
  '100%': {
    opacity: 1,
    transform: 'scale(1)',
  },
});

export const modalContent = style({
  padding: 0,
  overflow: 'hidden',
});

export const modalHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px 24px',
  borderBottom: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
});

export const titleSection = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
});

export const statusDot = style({
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  flexShrink: 0,
});

export const idle = style({
  backgroundColor: cssVar('textSecondaryColor'),
});

export const recording = style({
  backgroundColor: '#ff4444',
  animation: `${pulse} 2s infinite`,
  boxShadow: '0 0 8px rgba(255, 68, 68, 0.5)',
});

export const modalTitle = style({
  fontSize: '18px',
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
  margin: 0,
});

export const modalBody = style({
  padding: '24px',
  minHeight: '200px',
  maxHeight: '400px',
  overflowY: 'auto',
  background: cssVar('backgroundPrimaryColor'),
});

export const meetingList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
});

export const meetingItem = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

export const meetingHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  background: cssVar('hoverColor'),
  borderRadius: '8px',
});

export const meetingInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

export const meetingId = style({
  fontSize: '16px',
  fontWeight: 500,
  color: cssVar('textPrimaryColor'),
});

export const elapsedTime = style({
  fontSize: '14px',
  fontWeight: 600,
  color: cssVar('brandColor'),
  padding: '4px 12px',
  background: cssVar('backgroundSecondaryColor'),
  borderRadius: '16px',
});

export const description = style({
  fontSize: '14px',
  color: cssVar('textPrimaryColor'),
  fontWeight: 400,
  opacity: 0.8,
});

export const deviceName = style({
  fontSize: '13px',
  color: cssVar('textSecondaryColor'),
  fontWeight: 400,
});

export const divider = style({
  height: '1px',
  background: cssVar('borderColor'),
  margin: '8px 0',
});

export const deviceList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
});

export const sectionTitle = style({
  fontSize: '14px',
  fontWeight: 500,
  color: cssVar('textSecondaryColor'),
  marginBottom: '8px',
});

export const deviceGrid = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
});

export const deviceChip = style({
  padding: '8px 16px',
  background: cssVar('backgroundSecondaryColor'),
  color: cssVar('textPrimaryColor'),
  borderRadius: '20px',
  fontSize: '14px',
  fontWeight: 500,
  border: `1px solid ${cssVar('borderColor')}`,
  transition: 'all 0.2s ease',
  
  ':hover': {
    background: cssVar('hoverColor'),
    transform: 'translateY(-1px)',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  },
});

export const emptyState = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '150px',
  color: cssVar('textSecondaryColor'),
  fontSize: '14px',
});

export const modalFooter = style({
  display: 'flex',
  justifyContent: 'flex-end',
  padding: '16px 24px',
  borderTop: `1px solid ${cssVar('borderColor')}`,
  background: cssVar('backgroundPrimaryColor'),
});

export const closeButton = style({
  padding: '8px 24px',
  background: cssVar('brandColor'),
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  
  ':hover': {
    opacity: 0.9,
    transform: 'translateY(-1px)',
  },
  
  ':active': {
    transform: 'translateY(0)',
  },
});

