import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User, Asset } from "@shared/schema";
import { getUserById } from "./emailAuth";

export type Role = 'admin' | 'manager' | 'staff';

export const auth = {
  canViewAsset: (user: User | null, asset: Asset): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'manager') return asset.managerId === user.id;
    if (user.role === 'staff') return asset.staffId === user.id;
    return false;
  },

  canEditAsset: (user: User | null, asset: Asset): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'manager') return asset.managerId === user.id;
    return false;
  },

  canDeleteAsset: (user: User | null): boolean => {
    if (!user) return false;
    return user.role === 'admin';
  },

  canInspectAsset: (user: User | null, asset: Asset): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'manager') return asset.managerId === user.id;
    if (user.role === 'staff') return asset.staffId === user.id;
    return false;
  },

  canManageTeams: (user: User | null): boolean => {
    if (!user) return false;
    return user.role === 'admin';
  },

  canManageUsers: (user: User | null): boolean => {
    if (!user) return false;
    return user.role === 'admin';
  },

  canAddAsset: (user: User | null): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'manager';
  },

  canManageCategories: (user: User | null): boolean => {
    if (!user) return false;
    return user.role === 'admin';
  },
};

export async function getCurrentUser(req: Request): Promise<User | null> {
  const userId = (req.session as any)?.userId;
  
  if (!userId) {
    return null;
  }

  const user = await getUserById(userId);
  return user || null;
}

export function requireAuth(allowedRoles?: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.session as any)?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await getCurrentUser(req);
    
    if (!user) {
      return res.status(401).json({ error: "User not registered in the system" });
    }

    if (allowedRoles && !allowedRoles.includes(user.role as Role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    (req as any).currentUser = user;
    next();
  };
}
