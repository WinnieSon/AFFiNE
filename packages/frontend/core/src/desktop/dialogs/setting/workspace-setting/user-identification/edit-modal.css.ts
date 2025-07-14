import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

export const modalContent = style({
  width: 480,
  maxWidth: '90vw',
});

export const modalHeader = style({
  padding: '20px 24px',
  borderBottom: `1px solid ${cssVar('borderColor')}`,
});

export const modalTitle = style({
  fontSize: 18,
  fontWeight: 600,
  margin: 0,
  color: cssVar('textPrimaryColor'),
});

export const modalBody = style({
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
});

export const modalFooter = style({
  padding: '16px 24px',
  borderTop: `1px solid ${cssVar('borderColor')}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

export const footerActions = style({
  display: 'flex',
  gap: 8,
});

export const imageSection = style({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
});

export const imagePreview = style({
  width: 80,
  height: 80,
  borderRadius: '50%',
  overflow: 'hidden',
  border: `2px solid ${cssVar('borderColor')}`,
  flexShrink: 0,
});

export const previewImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const imagePlaceholder = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: cssVar('backgroundSecondaryColor'),
  color: cssVar('iconSecondaryColor'),

  '& svg': {
    width: 32,
    height: 32,
  },
});

export const fileInput = style({
  display: 'none',
});

export const formSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

export const formField = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const label = style({
  fontSize: 14,
  fontWeight: 500,
  color: cssVar('textPrimaryColor'),
});