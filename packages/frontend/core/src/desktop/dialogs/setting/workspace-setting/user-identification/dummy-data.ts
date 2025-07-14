// Dummy face images for testing
// These are simple SVG-based avatars with different colors

const createDummyAvatar = (color: string, initials: string) => {
  const svg = `
    <svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <circle cx="64" cy="64" r="64" fill="${color}"/>
      <text x="64" y="64" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle" dy=".35em">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export const dummyUserIdentifications = [
  {
    id: 'dummy-1',
    nickname: 'John Doe',
    title: 'Software Engineer',
    email: 'john.doe@example.com',
    imageData: createDummyAvatar('#4F46E5', 'JD'),
  },
  {
    id: 'dummy-2',
    nickname: 'Jane Smith',
    title: 'Product Manager',
    email: 'jane.smith@example.com',
    imageData: createDummyAvatar('#EC4899', 'JS'),
  },
  {
    id: 'dummy-3',
    nickname: 'Bob Johnson',
    title: 'Designer',
    email: 'bob.johnson@example.com',
    imageData: createDummyAvatar('#10B981', 'BJ'),
  },
  {
    id: 'dummy-4',
    nickname: null,
    title: null,
    email: null,
    imageData: createDummyAvatar('#F59E0B', '?'),
  },
  {
    id: 'dummy-5',
    nickname: null,
    title: null,
    email: null,
    imageData: createDummyAvatar('#EF4444', '?'),
  },
];

// Helper function to generate a random avatar
export const generateRandomAvatar = () => {
  const colors = ['#4F46E5', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#F97316'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const randomInitials = '?';
  return createDummyAvatar(randomColor, randomInitials);
};