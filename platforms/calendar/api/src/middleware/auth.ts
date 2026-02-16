import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthPayload {
  ename: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET || "calendar-api-dev-secret";

  try {
    const decoded = jwt.verify(token, secret) as AuthPayload;
    if (!decoded.ename) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }
    req.user = { ename: decoded.ename };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
