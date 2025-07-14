import { cssVar } from '@toeverything/theme';
import { style } from '@vanilla-extract/css';

export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  padding: '0 8px',
});

export const errorContainer = style({
  padding: 20,
  textAlign: 'center',
  color: cssVar('errorColor'),
});

export const section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
});

export const sectionTitle = style({
  fontSize: 16,
  fontWeight: 600,
  color: cssVar('textPrimaryColor'),
  margin: '0 0 8px 0',
});

export const userGrid = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  minHeight: 80,
  alignItems: 'flex-start',
});

export const userItem = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  width: 80,
});

export const userButton = style({
  position: 'relative',
  width: 64,
  height: 64,
  padding: 0,
  border: `2px solid ${cssVar('borderColor')}`,
  borderRadius: '50%',
  overflow: 'hidden',
  cursor: 'pointer',
  background: 'transparent',
  transition: 'all 0.2s',

  ':hover': {
    borderColor: cssVar('primaryColor'),
    transform: 'scale(1.05)',
  },
});

export const userImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const editIcon = style({
  position: 'absolute',
  bottom: -2,
  right: -2,
  background: cssVar('backgroundPrimaryColor'),
  border: `2px solid ${cssVar('backgroundPrimaryColor')}`,
  borderRadius: '50%',
  opacity: 0,
  transition: 'opacity 0.2s',

  selectors: {
    [`${userButton}:hover &`]: {
      opacity: 1,
    },
  },
});

export const userName = style({
  fontSize: 12,
  color: cssVar('textSecondaryColor'),
  textAlign: 'center',
  width: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const emptyText = style({
  color: cssVar('textSecondaryColor'),
  fontSize: 14,
  fontStyle: 'italic',
});