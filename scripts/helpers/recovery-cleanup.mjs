// Always attempt access-rule restoration and pool closure, even when another
// owned resource could not be removed. Return names only; errors may hold secrets.
export async function cleanupRecoveryResources(operations) {
  const failed = [];
  for (const name of ["closeStores", "closeRuntime", "closeRestored", "dropRestoreDatabase",
    "removeFixtures", "removeRuntimeRole", "restoreHba", "closeAdmin"]) {
    try { await operations[name](); } catch { failed.push(name); }
  }
  return { cleanup: failed.length === 0, failed };
}
