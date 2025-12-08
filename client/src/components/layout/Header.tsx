import { 
  Bell, 
  Search, 
  User as UserIcon,
  ChevronDown,
  LogOut
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { store, USERS } from "@/lib/mockData";
import { useState } from "react";
import { User } from "@/lib/types";
import { useLocation } from "wouter";

export function Header() {
  // Simple local state to force re-render for demo purposes
  const [currentUser, setCurrentUser] = useState<User>(store.currentUser);
  const [location] = useLocation();

  const handleSwitchUser = (userId: string) => {
    store.setCurrentUser(userId);
    setCurrentUser(store.currentUser);
    window.location.reload(); // Hard reload to reset everything for the new user context
  };

  const getPageTitle = () => {
    switch (location) {
      case '/': return '대시보드';
      case '/assets': return '장비 관리';
      case '/team': return '팀 현황';
      case '/settings': return '시스템 설정';
      default: return 'AssetGuard';
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background px-6 shadow-sm">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground">{getPageTitle()}</h1>
        </div>
        
        <div className="flex flex-1 items-center justify-end gap-x-4 lg:gap-x-6">
          <div className="flex items-center gap-x-4">
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Search className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-status-error ring-2 ring-background" />
            </Button>
          </div>
          
          <div className="h-6 w-px bg-border" aria-hidden="true" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="-m-1.5 flex items-center p-1.5">
                <span className="sr-only">Open user menu</span>
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`} />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <span className="hidden lg:flex lg:items-center">
                  <span className="ml-4 text-sm font-semibold leading-6 text-foreground" aria-hidden="true">
                    {currentUser.username}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{currentUser.username}</p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {currentUser.role} • {store.currentUser.teamId === 't1' ? '엔지니어링 A팀' : '물류팀'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>사용자 전환 (데모)</DropdownMenuLabel>
              {USERS.map(user => (
                <DropdownMenuItem 
                  key={user.id} 
                  onClick={() => handleSwitchUser(user.id)}
                  className={user.id === currentUser.id ? "bg-accent" : ""}
                >
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>{user.username} ({user.role})</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>로그아웃</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
