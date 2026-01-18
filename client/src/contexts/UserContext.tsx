import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Team } from "@/lib/types";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

interface AuthStatus {
  authenticated: boolean;
  registered?: boolean;
  user?: User;
  replitId?: string;
  email?: string;
  message?: string;
}

interface UserContextType {
  currentUser: User | null;
  currentTeam: Team | null;
  users: User[];
  teams: Team[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isRegistered: boolean;
  authMessage: string | null;
  login: () => void;
  logout: () => void;
  switchUser: (userId: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [devModeUserId, setDevModeUserId] = useState<string | null>(null);

  const { data: authStatus, isLoading: authLoading } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await fetch("/api/auth/user", { credentials: "include", cache: 'no-store' });
      if (res.status === 401) {
        return { authenticated: false };
      }
      return res.json();
    },
    retry: false,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => api.users.getAll(),
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: () => api.teams.getAll(),
  });

  const isAuthenticated = authStatus?.authenticated ?? false;
  const isRegistered = authStatus?.registered ?? false;
  const authMessage = authStatus?.message || null;
  
  let currentUser: User | null = null;
  
  if (isAuthenticated && isRegistered && authStatus?.user) {
    currentUser = authStatus.user;
  } else if (devModeUserId) {
    currentUser = users.find(u => u.id === devModeUserId) || null;
  }

  const currentTeam = currentUser ? teams.find(t => t.id === currentUser.teamId) || null : null;

  const login = () => {
    window.location.href = "/api/login";
  };

  const logout = () => {
    window.location.href = "/api/logout";
  };

  const switchUser = (userId: string) => {
    setDevModeUserId(userId);
  };

  return (
    <UserContext.Provider value={{
      currentUser,
      currentTeam,
      users,
      teams,
      isLoading: authLoading || usersLoading || teamsLoading,
      isAuthenticated,
      isRegistered,
      authMessage,
      login,
      logout,
      switchUser,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
