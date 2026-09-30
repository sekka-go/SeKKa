import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import { findUserById, type UserRole } from "../db/user-repository.js";

/**
 * لازم يتحط بعد requireAuth مباشرة. بيتأكد إن صاحب الجلسة عنده role من
 * القائمة الممرّرة فعليًا في DB (مش من أي قيمة جاية من الفرونت) — نسخة عامة
 * قابلة لإعادة الاستخدام من requireRiderRole (routes/rider.ts) و
 * requireCaptainRole (routes/captain.ts)، بدل ما كل Route جديد (Admin هنا)
 * يكرر نفس المنطق محليًا تاني.
 */
export function requireRole(db: DatabaseSync, ...roles: UserRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = findUserById(db, req.auth!.userId);
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "الخدمة دي مش متاحة ليك." });
      return;
    }
    next();
  };
}
