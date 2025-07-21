// Script to debug and fix admin panel redirect loop
// Run this in browser console while on the admin page

async function debugAdminRedirect() {
  console.log('Debugging admin redirect issue...');

  // 1. Check GraphQL endpoint
  try {
    const response = await fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query {
            serverConfig {
              initialized
              name
              type
            }
            currentUser {
              id
              email
              hasPassword
            }
          }
        `,
      }),
    });

    const data = await response.json();
    console.log('GraphQL Response:', data);

    if (data.data) {
      console.log('Server initialized:', data.data.serverConfig?.initialized);
      console.log('Current user:', data.data.currentUser);
    }
  } catch (error) {
    console.error('GraphQL error:', error);
  }

  // 2. Check localStorage
  console.log('\nChecking localStorage:');
  const authToken = localStorage.getItem('affine-auth-token');
  console.log('Auth token exists:', !!authToken);

  // 3. Check current location
  console.log('\nCurrent location:', window.location.pathname);

  // 4. Manual navigation functions
  window.goToSetup = () => {
    window.location.href = '/admin/setup';
  };

  window.goToAuth = () => {
    window.location.href = '/admin/auth';
  };

  window.goToAccounts = () => {
    window.location.href = '/admin/accounts';
  };

  console.log('\nManual navigation commands available:');
  console.log('- goToSetup() - Go to admin setup');
  console.log('- goToAuth() - Go to admin login');
  console.log('- goToAccounts() - Go to accounts page');
}

// Run the debug function
debugAdminRedirect();
