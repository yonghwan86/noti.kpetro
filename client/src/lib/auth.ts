import { User, Team, Asset } from "./types";

export type Role = 'admin' | 'manager' | 'staff';

export interface CurrentUser extends User {
  team?: Team;
}

const CURRENT_USER_KEY = 'current_user_id';

export const auth = {
  getCurrentUserId: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CURRENT_USER_KEY);
  },

  setCurrentUserId: (userId: string) => {
    localStorage.setItem(CURRENT_USER_KEY, userId);
  },

  clearCurrentUser: () => {
    localStorage.removeItem(CURRENT_USER_KEY);
  },

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

  canAccessTeamPage: (user: User | null): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'manager';
  },

  canManageUsers: (user: User | null): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'manager';
  },

  canAddAsset: (user: User | null): boolean => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'manager';
  },

  canManageCategories: (user: User | null): boolean => {
    if (!user) return false;
    return user.role === 'admin';
  },

  getRoleName: (role: Role): string => {
    switch (role) {
      case 'admin': return '마스터';
      case 'manager': return '대상 관리자';
      case 'staff': return '담당자';
      default: return role;
    }
  },

  filterAssetsForUser: (assets: Asset[], user: User | null): Asset[] => {
    if (!user) return [];
    if (user.role === 'admin') return assets;
    if (user.role === 'manager') return assets.filter(a => a.managerId === user.id);
    if (user.role === 'staff') return assets.filter(a => a.staffId === user.id);
    return [];
  }
};
