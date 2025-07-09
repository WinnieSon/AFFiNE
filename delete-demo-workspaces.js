// Script to delete all local/demo workspaces from AFFiNE
// Run this in the browser console

async function deleteAllDemoWorkspaces() {
  console.log('Starting cleanup of demo workspaces...');
  
  // 1. Clear localStorage
  console.log('Clearing localStorage...');
  const localWorkspaceIds = localStorage.getItem('affine-local-workspace');
  if (localWorkspaceIds) {
    console.log('Found local workspaces:', localWorkspaceIds);
    localStorage.removeItem('affine-local-workspace');
    localStorage.removeItem('last_workspace_id');
    localStorage.removeItem('is-first-open');
  }
  
  // 2. Clear IndexedDB databases
  console.log('Clearing IndexedDB databases...');
  try {
    const databases = await indexedDB.databases();
    console.log('Found databases:', databases.map(db => db.name));
    
    for (const db of databases) {
      if (db.name && (
        db.name.includes('affine') ||
        db.name.includes('workspace') ||
        db.name.endsWith(':doc') ||
        db.name.endsWith(':blob') ||
        db.name.endsWith(':server-clock') ||
        db.name.endsWith(':sync-metadata') ||
        db.name.endsWith('_blob')
      )) {
        try {
          await indexedDB.deleteDatabase(db.name);
          console.log(`Deleted database: ${db.name}`);
        } catch (err) {
          console.error(`Failed to delete database ${db.name}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Failed to enumerate databases:', err);
    // Fallback: try to delete known database patterns
    const knownPatterns = [
      'affine-local',
      'affine-meta',
      'affine-migration'
    ];
    
    for (const pattern of knownPatterns) {
      try {
        await indexedDB.deleteDatabase(pattern);
        console.log(`Deleted database: ${pattern}`);
      } catch (err) {
        // Ignore errors for non-existent databases
      }
    }
  }
  
  // 3. Clear other related localStorage items
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes('affine') ||
      key.includes('workspace') ||
      key.includes('blocksuite')
    )) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`Removed localStorage key: ${key}`);
  });
  
  console.log('Cleanup complete! Please refresh the page.');
  
  // 4. Optional: Force reload
  if (confirm('Demo workspaces deleted. Would you like to reload the page now?')) {
    window.location.reload();
  }
}

// Run the cleanup
deleteAllDemoWorkspaces();