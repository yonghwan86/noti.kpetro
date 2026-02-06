import { 
  Bell, 
  Search, 
  User as UserIcon,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Box,
  Users,
  Settings,
  FileText,
  Shield,
  Wrench,
  UserCheck,
  Menu
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
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUser } from "@/contexts/UserContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { Asset, InspectionLog } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function Header({ onMenuClick, showMenuButton }: HeaderProps) {
  const { currentUser, currentTeam, users, switchUser, logout } = useUser();
  const [location, setLocation] = useLocation();
  const [openSearch, setOpenSearch] = useState(false);

  const { data: logs = [] } = useQuery<InspectionLog[]>({
    queryKey: ["/api/logs"],
    queryFn: () => api.logs.getAll(),
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    queryFn: () => api.assets.getAll(),
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenSearch((open) => !open);
      }
    }
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSwitchUser = (userId: string) => {
    switchUser(userId);
  };

  const getPageTitle = () => {
    switch (location) {
      case '/': return '대시보드';
      case '/assets': return '스케줄 관리';
      case '/team': return '장비 구분 관리';
      case '/settings': return '시스템 설정';
      case '/logs': return '활동 로그';
      default: return '스케줄 관리시스템';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4" />;
      case 'manager': return <Wrench className="w-4 h-4" />;
      case 'staff': return <UserCheck className="w-4 h-4" />;
      default: return <UserIcon className="w-4 h-4" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return <Badge className="bg-purple-500 text-white text-xs">마스터</Badge>;
      case 'manager': return <Badge className="bg-blue-500 text-white text-xs">장비 관리자</Badge>;
      case 'staff': return <Badge variant="secondary" className="text-xs">담당자</Badge>;
      default: return null;
    }
  };

  const filteredAssets = currentUser ? auth.filterAssetsForUser(assets, currentUser) : [];

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-2 md:gap-x-4 border-b border-border bg-background px-4 md:px-6 shadow-sm">
      <div className="flex flex-1 gap-x-2 md:gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex items-center gap-2 md:gap-4">
          {showMenuButton && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onMenuClick}
              className="text-foreground"
              data-testid="button-mobile-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-base md:text-lg font-semibold text-foreground truncate">{getPageTitle()}</h1>
          {currentUser && <span className="hidden sm:inline-flex">{getRoleBadge(currentUser.role)}</span>}
        </div>
        
        <div className="flex flex-1 items-center justify-end gap-x-2 md:gap-x-4 lg:gap-x-6">
          <div className="flex items-center gap-x-2 md:gap-x-4">
            <Button variant="ghost" size="icon" className="text-muted-foreground hidden sm:flex" onClick={() => setOpenSearch(true)}>
              <Search className="h-5 w-5" />
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground relative">
                  <Bell className="h-5 w-5" />
                  {logs.length > 0 && (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-status-error ring-2 ring-background" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">알림</h4>
                    <p className="text-sm text-muted-foreground">
                      최근 시스템 활동 내역입니다.
                    </p>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="grid gap-2">
                      {logs.length === 0 ? (
                        <p className="text-sm text-center text-muted-foreground py-4">새로운 알림이 없습니다.</p>
                      ) : (
                        logs.slice(0, 10).map((log) => (
                          <div key={log.id} className="grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0 border-b last:border-0">
                            <span className="flex h-2 w-2 translate-y-1.5 rounded-full bg-sky-500" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium leading-none">
                                {log.notes}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(log.date), "MMM d, h:mm a")}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="h-6 w-px bg-border hidden md:block" aria-hidden="true" />

          {currentUser && (
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
              <DropdownMenuContent className="w-64" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{currentUser.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {auth.getRoleName(currentUser.role as any)} • {currentTeam?.name || '팀 없음'}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>역할별 보기 전환</DropdownMenuLabel>
                {['admin', 'manager', 'staff'].map((role) => {
                  const representativeUser = users.find(u => u.role === role);
                  if (!representativeUser) return null;
                  
                  return (
                    <DropdownMenuItem 
                      key={role}
                      onClick={() => handleSwitchUser(representativeUser.id)}
                      className={representativeUser.id === currentUser.id ? "bg-accent" : ""}
                    >
                      {getRoleIcon(role)}
                      <span className="ml-2">{auth.getRoleName(role as any)} 보기</span>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>로그아웃</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

        </div>
      </div>

      <CommandDialog open={openSearch} onOpenChange={setOpenSearch}>
        <CommandInput placeholder="검색어를 입력하세요... (장비, 메뉴 등)" />
        <CommandList>
          <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
          <CommandGroup heading="페이지 이동">
            <CommandItem onSelect={() => { setLocation("/"); setOpenSearch(false); }}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              대시보드
            </CommandItem>
            <CommandItem onSelect={() => { setLocation("/assets"); setOpenSearch(false); }}>
              <Box className="mr-2 h-4 w-4" />
              스케줄 관리
            </CommandItem>
            {auth.canAccessTeamPage(currentUser) && (
              <CommandItem onSelect={() => { setLocation("/team"); setOpenSearch(false); }}>
                <Users className="mr-2 h-4 w-4" />
                장비 구분 관리
              </CommandItem>
            )}
            <CommandItem onSelect={() => { setLocation("/logs"); setOpenSearch(false); }}>
              <FileText className="mr-2 h-4 w-4" />
              활동 로그
            </CommandItem>
            {auth.canManageTeams(currentUser) && (
              <CommandItem onSelect={() => { setLocation("/settings"); setOpenSearch(false); }}>
                <Settings className="mr-2 h-4 w-4" />
                시스템 설정
              </CommandItem>
            )}
          </CommandGroup>
          <CommandGroup heading="내 장비 검색">
            {filteredAssets.map((asset) => (
              <CommandItem key={asset.id} onSelect={() => { setLocation("/assets"); setOpenSearch(false); }}>
                <Box className="mr-2 h-4 w-4" />
                <span>{asset.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">({asset.serialNumber})</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}
