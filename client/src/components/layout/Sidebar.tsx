import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Settings, 
  ShieldCheck,
  Activity,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  onClose?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ onClose, isMobile }: SidebarProps) {
  const [location] = useLocation();
  const { currentUser } = useUser();

  const navigation = [
    { name: '대시보드', href: '/', icon: LayoutDashboard, show: true },
    { name: '스케줄 관리', href: '/assets', icon: Package, show: true },
    { name: '장비 구분 관리', href: '/team', icon: Users, show: auth.canManageTeams(currentUser) },
    { name: '설정', href: '/settings', icon: Settings, show: auth.canManageTeams(currentUser) },
  ].filter(item => item.show);

  const handleNavClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border/40">
        <div className="flex items-center">
          <ShieldCheck className="h-6 w-6 text-sidebar-primary mr-2" />
          <span className="text-lg font-bold tracking-tight">스케줄 관리시스템</span>
        </div>
        {isMobile && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-3">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href} onClick={handleNavClick}>
                <span
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                      isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 px-3">
          <div className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-2 px-3">
            시스템
          </div>
          <nav className="space-y-1">
            <Link href="/logs" onClick={handleNavClick}>
              <span className={cn(
                "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                location === '/logs'
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}>
                <Activity className={cn(
                  "mr-3 h-5 w-5",
                  location === '/logs' ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground"
                )} />
                활동 로그
              </span>
            </Link>
          </nav>
        </div>
      </div>

      <div className="p-4 border-t border-sidebar-border/40">
        <div className="flex items-center">
          <div className="ml-3">
            <p className="text-xs text-sidebar-foreground/50">v1.0.2-beta</p>
          </div>
        </div>
      </div>
    </div>
  );
}
