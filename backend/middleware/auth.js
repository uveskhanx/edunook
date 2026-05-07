import { admin } from '../config/firebase.js';

export async function authenticateFirebaseUser(req, res, next) {
  try {
    const header = req.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Missing Firebase auth token' });

    const decoded = await admin.auth().verifyIdToken(token);
    req.authUser = decoded;
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Invalid Firebase auth token' });
  }
}

export function requireMatchingUser(req, res, next) {
  const requestedUserId = req.body?.user_id;
  if (!requestedUserId || req.authUser?.uid !== requestedUserId) {
    return res.status(403).json({ error: 'Authenticated user does not match user_id' });
  }
  return next();
}
