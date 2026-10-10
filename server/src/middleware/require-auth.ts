import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { findActiveSessionByTokenHash } from "../db/session-repository.js";
import { hashSessionToken } from "../security/session-token.js";

export interface AuthContext {
  userId: number;
  sessionId: number;
  tokenHash: string;
}

// توسيع Express.Request عشان الـ Routes اللاحقة تقدر تقرأ req.auth بأمان بعد
// requireAuth، من غير الحاجة لـ `as any` في كل مكان.
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * يتحقق من وجود Session نشطة (مش ملغاة، ومش منتهية) مرتبطة بالـ Bearer token
 * في Header الـ Authorization. لو سليمة، بيحط req.auth ويكمل؛ لو لأ، يرد 401
 * برسالة عربية عامة من غير تفاصيل تقنية.
 */
export function requireAuth(db: DatabaseSync): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "لازم تسجّل الدخول الأول." });
      return;
    }

    const tokenHash = hashSessionToken(token);
    const session = findActiveSessionByTokenHash(db, tokenHash);
    if (!session) {
      res.status(401).json({ error: "جلسة الدخول مش شغالة، سجّل دخول تاني." });
      return;
    }

    req.auth = { userId: session.user_id, sessionId: session.id, tokenHash };
    next();
  };
}
