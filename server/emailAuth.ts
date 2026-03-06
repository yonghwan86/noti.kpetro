import bcrypt from "bcryptjs";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "./encryption";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function setupEmailAuth(app: Express) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  app.set("trust proxy", 1);
  app.use(session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  }));
}

export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return undefined;
  return { ...user, username: decrypt(user.username) };
}

export async function setUserPassword(userId: string, password: string) {
  const hash = await hashPassword(password);
  const [updated] = await db
    .update(users)
    .set({ passwordHash: hash })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) return undefined;
  return { ...updated, username: decrypt(updated.username) };
}

export async function resetUserPassword(userId: string) {
  const [updated] = await db
    .update(users)
    .set({ passwordHash: null })
    .where(eq(users.id, userId))
    .returning();
  if (!updated) return undefined;
  return { ...updated, username: decrypt(updated.username) };
}

export async function getUserById(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return undefined;
  return { ...user, username: decrypt(user.username) };
}

export function registerEmailAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "이메일과 비밀번호를 입력해주세요." });
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "등록되지 않은 이메일입니다." });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ 
          error: "비밀번호가 설정되지 않았습니다.", 
          needsPasswordSetup: true,
          userId: user.id 
        });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
      }

      (req.session as any).userId = user.id;
      
      const { passwordHash, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "로그인 처리 중 오류가 발생했습니다." });
    }
  });

  app.post("/api/auth/set-password", async (req: Request, res: Response) => {
    try {
      const { email, password, privacyConsent, optionalConsent } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "이메일과 비밀번호를 입력해주세요." });
      }

      if (password.length < 4) {
        return res.status(400).json({ error: "비밀번호는 4자리 이상이어야 합니다." });
      }

      if (!privacyConsent) {
        return res.status(400).json({ error: "필수 개인정보 수집에 동의해야 합니다." });
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "등록되지 않은 이메일입니다." });
      }

      if (user.passwordHash) {
        return res.status(400).json({ error: "이미 비밀번호가 설정되어 있습니다. 로그인해주세요." });
      }

      const now = new Date().toISOString();
      const hash = await hashPassword(password);
      const consentData: any = {
        passwordHash: hash,
        privacyConsentAt: now,
      };
      if (optionalConsent) {
        consentData.optionalConsentAt = now;
        consentData.optionalConsentGiven = true;
      }

      const [updated] = await db
        .update(users)
        .set(consentData)
        .where(eq(users.id, user.id))
        .returning();

      if (!updated) {
        return res.status(500).json({ error: "비밀번호 설정에 실패했습니다." });
      }

      (req.session as any).userId = updated.id;

      const decryptedUser = { ...updated, username: decrypt(updated.username) };
      const { passwordHash: _ph, ...safeUser } = decryptedUser;
      res.json({ success: true, user: safeUser });
    } catch (error) {
      console.error("Set password error:", error);
      res.status(500).json({ error: "비밀번호 설정 중 오류가 발생했습니다." });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "로그아웃 처리 중 오류가 발생했습니다." });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/user", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      
      if (!userId) {
        return res.json({ authenticated: false });
      }

      const user = await getUserById(userId);
      if (!user) {
        return res.json({ authenticated: false });
      }

      const { passwordHash, ...safeUser } = user;
      res.json({ 
        authenticated: true, 
        user: safeUser 
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "사용자 정보를 가져오는 중 오류가 발생했습니다." });
    }
  });

  app.post("/api/auth/check-email", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "이메일을 입력해주세요." });
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return res.json({ exists: false });
      }

      res.json({ 
        exists: true, 
        hasPassword: !!user.passwordHash,
        username: user.username
      });
    } catch (error) {
      console.error("Check email error:", error);
      res.status(500).json({ error: "이메일 확인 중 오류가 발생했습니다." });
    }
  });
}
