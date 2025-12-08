import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Team } from "@/lib/types";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

interface UserContextType {
  currentUser: User | null;
  currentTeam: Team | null;
  users: User[];
  teams: Team[];
  isLoading: boolean;
  switchUser: (userId: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(auth.getCurrentUserId());

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => api.users.getAll(),
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: () => api.teams.getAll(),
  });

  useEffect(() => {
    if (!currentUserId && users.length > 0) {
      const adminUser = users.find(u => u.role === 'admin');
      if (adminUser) {
        setCurrentUserId(adminUser.id);
        auth.setCurrentUserId(adminUser.id);
      }
    }
  }, [users, currentUserId]);

  const currentUser = users.find(u => u.id === currentUserId) || null;
  const currentTeam = currentUser ? teams.find(t => t.id === currentUser.teamId) || null : null;

  const switchUser = (userId: string) => {
    auth.setCurrentUserId(userId);
    setCurrentUserId(userId);
  };

  return (
    <UserContext.Provider value={{
      currentUser,
      currentTeam,
      users,
      teams,
      isLoading: usersLoading || teamsLoading,
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
