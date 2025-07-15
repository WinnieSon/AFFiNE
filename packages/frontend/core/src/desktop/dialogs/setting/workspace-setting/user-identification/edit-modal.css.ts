import { cssVar } from '@toeverything/theme';
import { globalStyle, style } from '@vanilla-extract/css';

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
  flexDirection: 'column',
  gap: 16,
});

export const imageGallery = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  maxHeight: 200,
  overflowY: 'auto',
});

export const imagePreview = style({
  position: 'relative',
  width: 80,
  height: 80,
  borderRadius: '50%',
  overflow: 'hidden',
  border: `2px solid ${cssVar('borderColor')}`,
  flexShrink: 0,
});

export const removeImageButton = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'rgba(255, 59, 48, 0.9)',
  border: '2px solid white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'white',
  opacity: 0,
  transition: 'all 0.2s ease',
  zIndex: 10,
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',

  '& svg': {
    width: 16,
    height: 16,
  },

  ':hover': {
    background: 'rgba(204, 65, 37, 0.95)',
    transform: 'translate(-50%, -50%) scale(1.1)',
  },

  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});

export const addImageButton = style({
  width: 80,
  height: 80,
  borderRadius: '50%',
  border: `2px dashed ${cssVar('borderColor')}`,
  background: cssVar('backgroundSecondaryColor'),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: cssVar('iconSecondaryColor'),
  flexShrink: 0,

  '& svg': {
    width: 32,
    height: 32,
  },

  ':hover': {
    background: cssVar('hoverColor'),
    borderColor: cssVar('primaryColor'),
  },
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

// Hover effect for showing delete button
globalStyle(`${imagePreview}:hover button`, {
  opacity: 1,
});
