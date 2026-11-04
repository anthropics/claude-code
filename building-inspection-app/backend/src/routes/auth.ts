import { Router, Request, Response, NextFunction } from 'express';
import {
  login, logout, validateToken,
  getAllUsers, getUserSessions, getUserDevices,
  revokeSession, registerUser,
} from '../services/authService';

export const authRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Middleware: Extract user from token
// ─────────────────────────────────────────────────────────────────────────────

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Kirjautuminen vaaditaan' });
  }

  const token = authHeader.slice(7);
  const result = validateToken(token);
  if (!result) {
    return res.status(401).json({ error: 'Istunto vanhentunut, kirjaudu uudelleen' });
  }

  // Attach user to request
  (req as any).user = result.user;
  (req as any).session = result.session;
  return next();
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Yllapitajan oikeudet vaaditaan' });
  }
  return next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth endpoints
// ─────────────────────────────────────────────────────────────────────────────

authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password, deviceName, platform } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Sahkoposti ja salasana vaaditaan' });
  }

  const userAgent = req.headers['user-agent'] || 'unknown';
  const result = login(
    email,
    password,
    deviceName || 'Tuntematon laite',
    platform || 'web',
    userAgent
  );

  if ('error' in result) {
    return res.status(401).json({ error: result.error });
  }

  return res.json(result);
});

authRouter.post('/logout', authMiddleware, (req: Request, res: Response) => {
  const token = req.headers.authorization!.slice(7);
  logout(token);
  return res.json({ success: true });
});

authRouter.get('/me', authMiddleware, (req: Request, res: Response) => {
  return res.json({ user: (req as any).user });
});

authRouter.get('/sessions', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const sessions = getUserSessions(user.id);
  return res.json({ sessions });
});

authRouter.get('/devices', authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  const devices = getUserDevices(user.id);
  return res.json({ devices });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin endpoints
// ─────────────────────────────────────────────────────────────────────────────

authRouter.get('/admin/users', authMiddleware, adminMiddleware, (_req: Request, res: Response) => {
  const users = getAllUsers();
  return res.json({ users });
});

authRouter.get('/admin/user/:userId/sessions', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const sessions = getUserSessions(req.params.userId);
  return res.json({ sessions });
});

authRouter.get('/admin/user/:userId/devices', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const devices = getUserDevices(req.params.userId);
  return res.json({ devices });
});

authRouter.post('/admin/session/:sessionId/revoke', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const success = revokeSession(req.params.sessionId);
  return res.json({ success });
});

authRouter.post('/admin/register', authMiddleware, adminMiddleware, (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Sahkoposti, salasana ja nimi vaaditaan' });
  }

  const result = registerUser(email, password, name, role);
  if ('error' in result) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ user: result });
});
