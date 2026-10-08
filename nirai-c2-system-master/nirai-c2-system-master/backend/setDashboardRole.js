import { adminAuth } from './firebaseAdmin.js';

const allowedRoles = new Set(['operator', 'field_commander', 'super_admin']);
const [actionOrAccount, accountOrRole, maybeRole, ...extraArgs] = process.argv.slice(2);
const isInspect = actionOrAccount === 'inspect';
const account = isInspect ? accountOrRole : actionOrAccount;
const role = isInspect ? null : accountOrRole;
const hasValidArguments = isInspect
  ? Boolean(account) && maybeRole === undefined && extraArgs.length === 0
  : Boolean(account) && allowedRoles.has(role) && maybeRole === undefined && extraArgs.length === 0;

if (!hasValidArguments) {
  console.error('Inspect: npm run set-dashboard-role -- inspect <firebase-uid-or-email>');
  console.error('Assign:  npm run set-dashboard-role -- <firebase-uid-or-email> <operator|field_commander|super_admin>');
  process.exitCode = 1;
} else if (!adminAuth) {
  console.error('Firebase Admin Auth is unavailable. Configure application-default credentials and retry.');
  process.exitCode = 1;
} else {
  try {
    const user = account.includes('@')
      ? await adminAuth.getUserByEmail(account.trim().toLowerCase())
      : await adminAuth.getUser(account);
    const currentRole = user.customClaims?.niraiRole ?? null;

    if (isInspect) {
      console.log(JSON.stringify({ uid: user.uid, email: user.email, niraiRole: currentRole }, null, 2));
    } else {
      await adminAuth.setCustomUserClaims(user.uid, {
        ...user.customClaims,
        niraiRole: role
      });
      console.log(`Updated NIRAI role for ${user.email || user.uid}: ${currentRole ?? 'unset'} -> ${role}. The user must refresh their ID token.`);
    }
  } catch (error) {
    if (error.code === 'app/invalid-credential') {
      console.error('Firebase Admin has no usable credentials. Configure Application Default Credentials for an administrator-authorized identity, then retry. Do not put service-account keys in source control.');
    } else {
      console.error(`Unable to ${isInspect ? 'inspect' : 'assign'} the NIRAI role: ${error.message}`);
    }
    process.exitCode = 1;
  }
}
