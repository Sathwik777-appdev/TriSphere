import { getAuth } from 'firebase-admin/auth';

/**
 * Auth middleware: verify Firebase ID token from Authorization header.
 * Attaches uid and role to the request object.
 */
export async function verifyAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization token.' });
    }
    try {
        const idToken = authHeader.split('Bearer ')[1];
        const decoded = await getAuth().verifyIdToken(idToken);
        req.uid = decoded.uid;
        req.userRole = decoded.role;
        next();
    } catch (err) {
        console.warn('Auth verification failed:', err.message);
        return res.status(401).json({ error: 'Invalid token.' });
    }
}
