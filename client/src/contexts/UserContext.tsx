import { createContext, useContext, useState, ReactNode } from "react";
import { User, Team } from "@/lib/types";
import { api } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AuthStatus {
  authenticated: boolean;
  user?: User;
}

interface UserContextType {
  currentUser: User | null;
  currentTeam: Team | null;
  users: User[];
  teams: Team[];
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refetchAuth: () => void;
  switchUser: (userId: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [devModeUserId, setDevModeUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: authStatus, isLoading: authLoading, refetch: refetchAuth } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await fetch("/api/auth/user", { credentials: "include", cache: 'no-store' });
      if (res.status === 401) {
        return { authenticated: false };
      }
      return res.json();
    },
    retry: false,
    staleTime: 0,
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
  
  let currentUser: User | null = null;
  
  if (isAuthenticated && authStatus?.user) {
    if (devModeUserId) {
      currentUser = users.find(u => u.id === devModeUserId) || authStatus.user;
    } else {
      currentUser = authStatus.user;
    }
  }

  const currentTeam = currentUser ? teams.find(t => t.id === currentUser.teamId) || null : null;

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (err) {
      console.error("Logout error:", err);
    }
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
      logout,
      refetchAuth,
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
