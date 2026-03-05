import { useState, useMemo } from "react";
import { User, Role, Team as TeamType, Category, Asset, Department } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, UserPlus, Users, Pencil, MoreHorizontal, ShieldAlert, KeyRound, Download, Upload, Tags, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import ExcelImportDialog from "@/components/ExcelImportDialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { auth } from "@/lib/auth";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function Team() {
  const { currentUser } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [recentUserIds, setRecentUserIds] = useState<string[]>([]);

  const pushRecentUser = (id: string) => {
    setRecentUserIds(prev => [id, ...prev.filter(x => x !== id)]);
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => api.users.getAll(),
  });

  const { data: teams = [] } = useQuery<TeamType[]>({
    queryKey: ["/api/teams"],
    queryFn: () => api.teams.getAll(),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => api.categories.getAll(),
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    queryFn: () => api.assets.getAll(),
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    queryFn: () => api.departments.getAll(),
  });

  const userAssetCategoryMap = useMemo(() => {
    const map: Record<string, Record<string, string[]>> = {};
    for (const asset of assets) {
      if (!asset.staffId || !asset.categoryId) continue;
      if (!map[asset.staffId]) map[asset.staffId] = {};
      if (!map[asset.staffId][asset.categoryId]) map[asset.staffId][asset.categoryId] = [];
      map[asset.staffId][asset.categoryId].push(asset.name);
    }
    return map;
  }, [assets]);

  const getDeptName = (teamId: string | null) => {
    if (!teamId) return "-";
    const team = teams.find(t => t.id === teamId);
    if (!team?.departmentId) return "-";
    return departments.find(d => d.id === team.departmentId)?.name || "-";
  };

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => api.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "구분 삭제됨", description: "구분이 시스템에서 제거되었습니다.", variant: "destructive" });
    },
    onError: (error: Error) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "사용자 삭제됨",
        description: "사용자가 시스템에서 제거되었습니다.",
        variant: "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (id: string) => api.teams.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: "팀 삭제됨",
        description: "팀이 시스템에서 제거되었습니다.",
        variant: "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTeamMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TeamType> }) => api.teams.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: "팀 수정됨",
        description: "팀 정보가 업데이트되었습니다.",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) => api.users.update(id, data),
    onSuccess: (_data, variables) => {
      pushRecentUser(variables.id);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "사용자 수정됨",
        description: "사용자 정보가 업데이트되었습니다.",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/users/${id}/reset-password`, { method: 'POST' }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "비밀번호 초기화됨",
        description: "사용자가 다음 로그인 시 새 비밀번호를 설정할 수 있습니다.",
      });
    },
  });

  const handleResetPassword = (id: string, username: string) => {
    if (confirm(`${username}님의 비밀번호를 초기화하시겠습니까?\n다음 로그인 시 새 비밀번호를 설정해야 합니다.`)) {
      resetPasswordMutation.mutate(id);
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager';

  const ITEMS_PER_PAGE = 10;
  const [categoryPage, setCategoryPage] = useState(1);
  const [managerPage, setManagerPage] = useState(1);
  const [staffPage, setStaffPage] = useState(1);
  const [adminPage, setAdminPage] = useState(1);
  const [managerCategoryFilter, setManagerCategoryFilter] = useState<string>("all");

  if (!auth.canAccessTeamPage(currentUser)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>접근 권한이 없습니다</CardTitle>
            <CardDescription>
              이 페이지는 관리자 이상 권한이 필요합니다.
              필요한 경우 시스템 관리자에게 문의하세요.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const sortRecent = (list: User[]) => {
    if (recentUserIds.length === 0) return list;
    return [...list].sort((a, b) => {
      const aIdx = recentUserIds.indexOf(a.id);
      const bIdx = recentUserIds.indexOf(b.id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return 0;
    });
  };

  const adminUsers = users.filter(u => u.role === 'admin');
  const filteredAdminUsers = adminUsers.filter(u => {
    const search = searchTerm.toLowerCase();
    return (
      u.username.toLowerCase().includes(search) ||
      (u.email || '').toLowerCase().includes(search) ||
      teams.find(t => t.id === u.teamId)?.name.toLowerCase().includes(search)
    );
  });
  const managerUsers = users.filter(u => u.role === 'manager');
  const visibleCategories = isManager && currentUser
    ? categories.filter(c => (c.managerIds || []).includes(currentUser.id))
    : categories;
  const filteredCategories = visibleCategories.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.managerIds || []).some(mid => (users.find(u => u.id === mid)?.username || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const filteredManagerUsers = sortRecent(managerUsers.filter(
    (user) =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      teams.find((t) => t.id === user.teamId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const myCategories = isManager && currentUser
    ? categories.filter(c => (c.managerIds || []).includes(currentUser.id))
    : [];

  const filteredStaffUsers = sortRecent(users.filter(
    (user) => {
      if (user.role !== 'staff') return false;
      if (isManager && currentUser) {
        if (user.managerId !== currentUser.id) return false;
        if (managerCategoryFilter !== "all") {
          if (!userAssetCategoryMap[user.id]?.[managerCategoryFilter]?.length) return false;
        }
      }
      const search = searchTerm.toLowerCase();
      return (
        user.username.toLowerCase().includes(search) ||
        (user.email || '').toLowerCase().includes(search) ||
        teams.find((t) => t.id === user.teamId)?.name.toLowerCase().includes(search)
      );
    }
  ));

  const handleDeleteUser = (id: string) => {
    deleteUserMutation.mutate(id);
  };

  const handleDeleteTeam = (id: string) => {
    deleteTeamMutation.mutate(id);
  };

  const handleEditTeam = (id: string, data: Partial<TeamType>) => {
    updateTeamMutation.mutate({ id, data });
  };

  const handleEditUser = (id: string, data: Partial<User>) => {
    updateUserMutation.mutate({ id, data });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">관리</h2>
        <p className="text-muted-foreground">
          구분과 사용자를 관리합니다.
        </p>
      </div>

      <Tabs defaultValue={(isAdmin || isManager) ? "equipTypes" : "staff"} className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <TabsList className="w-full sm:w-auto flex-wrap">
            {(isAdmin || isManager) && (
              <TabsTrigger value="equipTypes" className="gap-2"><Tags className="w-4 h-4"/> 구분</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="managers" className="gap-2"><Users className="w-4 h-4"/> 구분 관리자 (역할)</TabsTrigger>
            )}
            <TabsTrigger value="staff" className="gap-2"><UserPlus className="w-4 h-4"/> {isAdmin ? "사용자 관리" : "배정 담당자"}</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admins" className="gap-2"><Shield className="w-4 h-4"/> 마스터</TabsTrigger>
            )}
          </TabsList>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="검색..."
              className="pl-8 h-9"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCategoryPage(1); setManagerPage(1); setStaffPage(1); }}
            />
          </div>
        </div>

        {(isAdmin || isManager) && <TabsContent value="equipTypes" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              {isAdmin ? '구분을 등록하고 담당 관리자를 지정합니다.' : '담당 구분을 관리합니다.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href="/api/categories/export" download>
                  <Download className="h-4 w-4" />
                  다운로드
                </a>
              </Button>
              <ExcelImportDialog
                title="구분 엑셀 업로드"
                description="엑셀 파일에서 구분 목록을 일괄 등록합니다."
                templateUrl="/api/categories/template"
                importUrl="/api/categories/import"
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/categories"] })}
              />
              <AddEquipTypeCategoryDialog allUsers={users} currentUser={currentUser} />
            </div>
          </div>
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>구분명</TableHead>
                  <TableHead>기본 주기</TableHead>
                  <TableHead>담당 관리자</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>소속팀</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      등록된 구분이 없습니다. "구분 등록" 버튼을 눌러 추가하세요.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCategories.slice((categoryPage - 1) * ITEMS_PER_PAGE, categoryPage * ITEMS_PER_PAGE).map((category) => {
                    const categoryManagers = (category.managerIds || []).map(mid => users.find(u => u.id === mid)).filter(Boolean);
                    return (
                      <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell>{category.defaultCycleDays ? `${category.defaultCycleDays}일` : "-"}</TableCell>
                        <TableCell>{categoryManagers.length > 0 ? categoryManagers.map(m => m!.username).join(", ") : "-"}</TableCell>
                        <TableCell className="text-sm">{categoryManagers.length > 0 ? Array.from(new Set(categoryManagers.map(m => getDeptName(m!.teamId)).filter(v => v !== "-"))).join(", ") || "-" : "-"}</TableCell>
                        <TableCell>{categoryManagers.length > 0 ? Array.from(new Set(categoryManagers.map(m => teams.find(t => t.id === m!.teamId)?.name).filter(Boolean))).join(", ") : "-"}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-category-menu-${category.id}`}>
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>작업</DropdownMenuLabel>
                              {auth.canEditCategory(currentUser, category) && (
                                <>
                                  <EditCategoryDialog category={category} allUsers={users} currentUser={currentUser} />
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => deleteCategoryMutation.mutate(category.id)}
                                    data-testid={`button-delete-category-${category.id}`}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    삭제
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination currentPage={categoryPage} totalItems={filteredCategories.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCategoryPage} />
        </TabsContent>}

        {isAdmin && <TabsContent value="managers" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              전체 사용자 중 구분 관리자 역할을 부여합니다.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href="/api/users/export" download>
                  <Download className="h-4 w-4" />
                  다운로드
                </a>
              </Button>
              <ExcelImportDialog
                title="구분 관리자 엑셀 업로드"
                description="엑셀 파일에서 구분 관리자 목록을 일괄 등록합니다."
                templateUrl="/api/users/template"
                importUrl="/api/users/import"
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/users"] })}
              />
              <PromoteToManagerDialog users={users} teams={teams} onPromoted={pushRecentUser} departments={departments} />
            </div>
          </div>
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>소속팀</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>로그인</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredManagerUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      등록된 구분 관리자가 없습니다. "구분 관리자 배정" 버튼을 눌러 사용자를 구분 관리자로 배정하세요.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredManagerUsers.slice((managerPage - 1) * ITEMS_PER_PAGE, managerPage * ITEMS_PER_PAGE).map((user) => (
                    <TableRow key={user.id} data-testid={`row-manager-${user.id}`}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell className="text-sm">{getDeptName(user.teamId)}</TableCell>
                      <TableCell>{teams.find(t => t.id === user.teamId)?.name || "-"}</TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
                      <TableCell>
                        {user.email ? (
                          user.hasPassword ? (
                            <Badge className="bg-green-500 hover:bg-green-600">설정완료</Badge>
                          ) : (
                            <Badge variant="outline">미설정</Badge>
                          )
                        ) : (
                          <Badge variant="secondary">이메일 없음</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-manager-menu-${user.id}`}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>작업</DropdownMenuLabel>
                            <EditUserDialog user={user} teams={teams} onEdit={handleEditUser} departments={departments} />
                            {user.hasPassword && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleResetPassword(user.id, user.username)}>
                                  <KeyRound className="mr-2 h-4 w-4" />
                                  비밀번호 초기화
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (confirm(`"${user.username}" 님을 구분 관리자에서 해제하시겠습니까? 사용자 계정은 유지됩니다.`)) {
                                  handleEditUser(user.id, { role: 'staff' });
                                }
                              }}
                              data-testid={`button-demote-manager-${user.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              구분 관리자 해제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination currentPage={managerPage} totalItems={filteredManagerUsers.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setManagerPage} />
        </TabsContent>}

        <TabsContent value="staff" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              {isAdmin 
                ? "회사 전체 직원 계정을 등록합니다. 이곳에서 등록된 사용자를 '구분 관리자' 탭에서 관리자 역할로 배정할 수 있습니다." 
                : "배정된 담당자 목록입니다. 구분별로 필터링하거나 '사용자 배정' 버튼으로 담당자를 추가할 수 있습니다."}
            </p>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {isAdmin && (
                <>
                  <Button variant="outline" size="sm" className="gap-2" asChild data-testid="button-staff-export">
                    <a href="/api/staff/export" download>
                      <Download className="h-4 w-4" />
                      다운로드
                    </a>
                  </Button>
                  <ExcelImportDialog
                    title="사용자 엑셀 업로드"
                    description="엑셀 파일에서 사용자(담당자) 목록을 일괄 등록합니다."
                    templateUrl="/api/staff/template"
                    importUrl="/api/staff/import"
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/users"] })}
                  />
                  <AddStaffUserDialog teams={teams} onCreated={pushRecentUser} departments={departments} />
                </>
              )}
              {isManager && (
                <>
                  <Button variant="outline" size="sm" className="gap-2" asChild data-testid="button-staff-export">
                    <a href="/api/staff/export" download>
                      <Download className="h-4 w-4" />
                      다운로드
                    </a>
                  </Button>
                  <ExcelImportDialog
                    title="사용자 엑셀 업로드"
                    description="엑셀 파일에서 사용자(담당자) 목록을 일괄 등록합니다. '배정 구분' 컬럼으로 구분을 지정할 수 있습니다."
                    templateUrl="/api/staff/template"
                    importUrl="/api/staff/import"
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/users"] })}
                  />
                  <AssignStaffDialog users={users} categories={myCategories} onAssigned={() => queryClient.invalidateQueries({ queryKey: ["/api/users"] })} teams={teams} departments={departments} />
                </>
              )}
            </div>
          </div>
          {isManager && myCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={managerCategoryFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => { setManagerCategoryFilter("all"); setStaffPage(1); }}
                data-testid="button-filter-all"
              >
                전체
              </Button>
              {myCategories.map(cat => (
                <Button
                  key={cat.id}
                  variant={managerCategoryFilter === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setManagerCategoryFilter(cat.id); setStaffPage(1); }}
                  data-testid={`button-filter-category-${cat.id}`}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          )}
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[850px]">
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>직책</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>소속팀</TableHead>
                  <TableHead>구분</TableHead>
                  <TableHead>대상</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>로그인</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaffUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      {isAdmin 
                        ? '등록된 사용자가 없습니다. "사용자 추가" 버튼을 눌러 추가하세요.'
                        : '배정된 담당자가 없습니다. "사용자 배정" 버튼을 눌러 추가하세요.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaffUsers.slice((staffPage - 1) * ITEMS_PER_PAGE, staffPage * ITEMS_PER_PAGE).map((user) => (
                    <TableRow key={user.id} data-testid={`row-staff-${user.id}`}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.position || "-"}</TableCell>
                      <TableCell className="text-sm">{getDeptName(user.teamId)}</TableCell>
                      <TableCell>
                        {teams.find((t) => t.id === user.teamId)?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {userAssetCategoryMap[user.id]
                          ? Object.entries(userAssetCategoryMap[user.id]).map(([catId, names], idx) => {
                              const catName = categories.find(c => c.id === catId)?.name || catId;
                              return <div key={catId}>{catName}</div>;
                            })
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {userAssetCategoryMap[user.id]
                          ? Object.entries(userAssetCategoryMap[user.id]).map(([catId, names]) => (
                              <div key={catId}>{names.join(", ")}</div>
                            ))
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
                      <TableCell>
                        {user.email ? (
                          user.hasPassword ? (
                            <Badge className="bg-green-500 hover:bg-green-600">설정완료</Badge>
                          ) : (
                            <Badge variant="outline">미설정</Badge>
                          )
                        ) : (
                          <Badge variant="secondary">이메일 없음</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>작업</DropdownMenuLabel>
                              <EditUserDialog user={user} teams={teams} onEdit={handleEditUser} departments={departments} />
                              {isAdmin && user.hasPassword && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleResetPassword(user.id, user.username)}>
                                    <KeyRound className="mr-2 h-4 w-4" />
                                    비밀번호 초기화
                                  </DropdownMenuItem>
                                </>
                              )}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleDeleteUser(user.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    삭제
                                  </DropdownMenuItem>
                                </>
                              )}
                              {isManager && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleEditUser(user.id, { managerId: null, assignedCategoryIds: [] })}
                                  >
                                    <UserPlus className="mr-2 h-4 w-4" />
                                    배정 해제
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination currentPage={staffPage} totalItems={filteredStaffUsers.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setStaffPage} />
        </TabsContent>

        {isAdmin && <TabsContent value="admins" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              시스템 최고 관리자(마스터) 계정을 직접 생성합니다. 마스터는 모든 기능에 접근할 수 있습니다.
            </p>
            <div className="flex flex-wrap gap-2">
              <AddMasterDialog teams={teams} onCreated={pushRecentUser} departments={departments} />
            </div>
          </div>
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>소속팀</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>로그인</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdminUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      등록된 마스터 계정이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAdminUsers.slice((adminPage - 1) * ITEMS_PER_PAGE, adminPage * ITEMS_PER_PAGE).map((user) => (
                    <TableRow key={user.id} data-testid={`row-admin-${user.id}`}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell className="text-sm">{getDeptName(user.teamId)}</TableCell>
                      <TableCell>{teams.find(t => t.id === user.teamId)?.name || "-"}</TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
                      <TableCell>
                        {user.email ? (
                          user.hasPassword ? (
                            <Badge className="bg-green-500 hover:bg-green-600">설정완료</Badge>
                          ) : (
                            <Badge variant="outline">미설정</Badge>
                          )
                        ) : (
                          <Badge variant="secondary">이메일 없음</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-admin-menu-${user.id}`}>
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>작업</DropdownMenuLabel>
                            <EditUserDialog user={user} teams={teams} onEdit={handleEditUser} departments={departments} />
                            {user.hasPassword && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleResetPassword(user.id, user.username)}>
                                  <KeyRound className="mr-2 h-4 w-4" />
                                  비밀번호 초기화
                                </DropdownMenuItem>
                              </>
                            )}
                            {currentUser?.id !== user.id && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    if (confirm(`"${user.username}" 님의 마스터 권한을 해제하시겠습니까?`)) {
                                      handleEditUser(user.id, { role: 'staff' });
                                    }
                                  }}
                                  data-testid={`button-demote-admin-${user.id}`}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  마스터 해제
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination currentPage={adminPage} totalItems={filteredAdminUsers.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setAdminPage} />
        </TabsContent>}

      </Tabs>
    </div>
  );
}

function EditUserDialog({ user, teams, onEdit, departments }: { user: User, teams: TeamType[], onEdit: (id: string, data: Partial<User>) => void, departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(user.teamId || "");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("__all__");
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      username: user.username,
      fullName: user.fullName || "",
      position: user.position || "",
      email: user.email || "",
      phone: user.phone || "",
    }
  });
  const isStaffUser = user.role === 'staff';
  const { toast } = useToast();

  const deptFilteredTeams = selectedDeptId === "__all__" ? teams : teams.filter(t => t.departmentId === selectedDeptId);

  const onSubmit = async (data: any) => {
    if (!selectedTeamId) {
      toast({ title: "소속팀을 선택해주세요.", variant: "destructive" });
      return;
    }
    onEdit(user.id, {
      username: data.username,
      fullName: data.fullName || undefined,
      position: data.position || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      teamId: selectedTeamId,
    });
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      const currentTeam = teams.find(t => t.id === user.teamId);
      setSelectedTeamId(user.teamId || "");
      setSelectedDeptId(currentTeam?.departmentId || "__all__");
      reset({
        username: user.username,
        fullName: user.fullName || "",
        position: user.position || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Pencil className="mr-2 h-4 w-4" />
          수정
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>사용자 정보 수정</DialogTitle>
          <DialogDescription>사용자 정보를 업데이트합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">이름</Label>
              <Input
                id="edit-username"
                {...register("username", { required: true })}
                data-testid="input-edit-username"
              />
            </div>
            {isStaffUser && (
              <div className="space-y-2">
                <Label htmlFor="edit-position">직책</Label>
                <Input
                  id="edit-position"
                  {...register("position")}
                  placeholder="팀장, 대리 등"
                  data-testid="input-edit-position"
                />
              </div>
            )}
          </div>
          {departments.length > 0 && (
            <div className="space-y-2">
              <Label>부서</Label>
              <Select value={selectedDeptId} onValueChange={(v) => { setSelectedDeptId(v); setSelectedTeamId(""); }}>
                <SelectTrigger data-testid="select-edit-department">
                  <SelectValue placeholder="부서 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">전체 부서</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>소속 팀</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger data-testid="select-edit-team">
                <SelectValue placeholder="팀 선택" />
              </SelectTrigger>
              <SelectContent>
                {deptFilteredTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">이메일</Label>
              <Input
                id="edit-email"
                type="email"
                {...register("email")}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">전화번호</Label>
              <Input
                id="edit-phone"
                {...register("phone")}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit">저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const CYCLE_PRESETS = [
  { value: "none", label: "선택 안함" },
  { value: "7", label: "7일 (1주)" },
  { value: "14", label: "14일 (2주)" },
  { value: "30", label: "30일 (1개월)" },
  { value: "90", label: "90일 (3개월)" },
  { value: "180", label: "180일 (6개월)" },
  { value: "365", label: "365일 (1년)" },
  { value: "730", label: "730일 (2년)" },
  { value: "custom", label: "직접 지정" },
];

function AddEquipTypeCategoryDialog({ allUsers, currentUser }: { allUsers: User[], currentUser: User | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [cycleSelectValue, setCycleSelectValue] = useState<string>("none");
  const [customCycleDays, setCustomCycleDays] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isManagerUser = currentUser?.role === 'manager';
  const selectableUsers = allUsers.filter(u => u.role !== 'admin');
  const filteredUsers = selectableUsers.filter(u =>
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const effectiveCycleDays = cycleSelectValue === "custom" ? (parseInt(customCycleDays) || null) : (cycleSelectValue && cycleSelectValue !== "none" ? parseInt(cycleSelectValue) : null);
  const finalManagerIds = isManagerUser && currentUser ? [currentUser.id] : selectedManagerIds;

  const createMutation = useMutation({
    mutationFn: () => api.categories.create({ name, managerIds: finalManagerIds, defaultCycleDays: effectiveCycleDays }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setOpen(false);
      setName("");
      setSelectedManagerIds([]);
      setUserSearch("");
      setCycleSelectValue("none");
      setCustomCycleDays("");
      toast({ title: "구분 등록 완료", description: "새로운 구분이 등록되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "등록 실패", description: error.message, variant: "destructive" });
    },
  });

  const toggleManager = (id: string) => {
    setSelectedManagerIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setName("");
      setSelectedManagerIds([]);
      setUserSearch("");
      setCycleSelectValue("none");
      setCustomCycleDays("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-category">
          <Plus className="w-4 h-4" /> 구분 등록
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>구분 등록</DialogTitle>
          <DialogDescription>구분을 등록한 뒤, AI 업무 알림 서비스 페이지에서 해당 구분에 대상을 등록할 수 있습니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">구분명</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="검사장비, 차량 등"
              required
              data-testid="input-category-name"
            />
          </div>
          <div className="space-y-2">
            <Label>기본 점검 주기</Label>
            <p className="text-xs text-muted-foreground">AI 업무 알림 서비스에서 이 구분을 선택하면 기본값으로 적용됩니다.</p>
            <Select value={cycleSelectValue} onValueChange={setCycleSelectValue}>
              <SelectTrigger>
                <SelectValue placeholder="주기 선택 (선택사항)" />
              </SelectTrigger>
              <SelectContent>
                {CYCLE_PRESETS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cycleSelectValue === "custom" && (
              <Input
                type="number"
                min={1}
                placeholder="일수 입력"
                value={customCycleDays}
                onChange={(e) => setCustomCycleDays(e.target.value)}
              />
            )}
          </div>
          {isManagerUser ? (
            <div className="space-y-2">
              <Label>담당 관리자</Label>
              <p className="text-sm text-muted-foreground border rounded-md p-2">{currentUser?.username} (본인)</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>담당 관리자 (복수 선택 가능)</Label>
              <Input
                placeholder="사용자 검색..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="mb-2 h-8 text-sm"
              />
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1" data-testid="select-category-managers">
                {filteredUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-1">
                    {userSearch ? "검색 결과가 없습니다." : "등록된 사용자가 없습니다."}
                  </p>
                ) : (
                  filteredUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 p-1 rounded hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedManagerIds.includes(u.id)}
                        onChange={() => toggleManager(u.id)}
                        className="rounded"
                        data-testid={`checkbox-manager-${u.id}`}
                      />
                      <span className="text-sm">{u.username}</span>
                      <span className="text-xs text-muted-foreground">({u.role === 'manager' ? '구분 관리자' : '사용자'})</span>
                    </label>
                  ))
                )}
              </div>
              {selectedManagerIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedManagerIds.length}명 선택됨</p>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-category">등록</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({ category, allUsers, currentUser }: { category: Category, allUsers: User[], currentUser: User | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name);
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>(category.managerIds || []);
  const [userSearch, setUserSearch] = useState("");
  const currentDays = category.defaultCycleDays;
  const presetMatch = currentDays ? CYCLE_PRESETS.find(o => o.value !== "custom" && o.value !== "none" && parseInt(o.value) === currentDays) : null;
  const [cycleSelectValue, setCycleSelectValue] = useState<string>(presetMatch ? presetMatch.value : (currentDays ? "custom" : "none"));
  const [customCycleDays, setCustomCycleDays] = useState<string>(presetMatch ? "" : (currentDays ? String(currentDays) : ""));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const selectableUsers = allUsers.filter(u => u.role !== 'admin');
  const filteredUsers = selectableUsers.filter(u =>
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const selectedFirst = [...filteredUsers].sort((a, b) => {
    const aSelected = selectedManagerIds.includes(a.id) ? 0 : 1;
    const bSelected = selectedManagerIds.includes(b.id) ? 0 : 1;
    return aSelected - bSelected;
  });

  const effectiveCycleDays = cycleSelectValue === "custom" ? (parseInt(customCycleDays) || null) : (cycleSelectValue && cycleSelectValue !== "none" ? parseInt(cycleSelectValue) : null);

  const updateMutation = useMutation({
    mutationFn: () => api.categories.update(category.id, { name, managerIds: selectedManagerIds, defaultCycleDays: effectiveCycleDays }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setOpen(false);
      toast({ title: "구분 수정됨", description: "구분 정보가 업데이트되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
    },
  });

  const toggleManager = (id: string) => {
    setSelectedManagerIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateMutation.mutate();
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setName(category.name);
      setSelectedManagerIds(category.managerIds || []);
      setUserSearch("");
      const cd = category.defaultCycleDays;
      const pm = cd ? CYCLE_PRESETS.find(o => o.value !== "custom" && o.value !== "none" && parseInt(o.value) === cd) : null;
      setCycleSelectValue(pm ? pm.value : (cd ? "custom" : "none"));
      setCustomCycleDays(pm ? "" : (cd ? String(cd) : ""));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} data-testid={`button-edit-category-${category.id}`}>
          <Pencil className="mr-2 h-4 w-4" />
          수정
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>구분 수정</DialogTitle>
          <DialogDescription>구분 정보를 업데이트합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-category-name">구분명</Label>
            <Input
              id="edit-category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              data-testid="input-edit-category-name"
            />
          </div>
          <div className="space-y-2">
            <Label>기본 점검 주기</Label>
            <Select value={cycleSelectValue} onValueChange={setCycleSelectValue}>
              <SelectTrigger>
                <SelectValue placeholder="주기 선택 (선택사항)" />
              </SelectTrigger>
              <SelectContent>
                {CYCLE_PRESETS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cycleSelectValue === "custom" && (
              <Input
                type="number"
                min={1}
                placeholder="일수 입력"
                value={customCycleDays}
                onChange={(e) => setCustomCycleDays(e.target.value)}
              />
            )}
          </div>
          {currentUser?.role === 'manager' ? (
            <div className="space-y-2">
              <Label>담당 관리자</Label>
              <p className="text-sm text-muted-foreground border rounded-md p-2">{currentUser?.username} (본인)</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>담당 관리자 (복수 선택 가능)</Label>
              <Input
                placeholder="사용자 검색..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="mb-2 h-8 text-sm"
              />
              <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1" data-testid="select-edit-category-managers">
                {selectedFirst.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-1">
                    {userSearch ? "검색 결과가 없습니다." : "등록된 사용자가 없습니다."}
                  </p>
                ) : (
                  selectedFirst.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 p-1 rounded hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedManagerIds.includes(u.id)}
                        onChange={() => toggleManager(u.id)}
                        className="rounded"
                        data-testid={`checkbox-edit-manager-${u.id}`}
                      />
                      <span className="text-sm">{u.username}</span>
                      <span className="text-xs text-muted-foreground">({u.role === 'manager' ? '구분 관리자' : '사용자'})</span>
                    </label>
                  ))
                )}
              </div>
              {selectedManagerIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedManagerIds.length}명 선택됨</p>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit-category">저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PromoteToManagerDialog({ users, teams, onPromoted, departments }: { users: User[], teams: TeamType[], onPromoted?: (id: string) => void, departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPromoting, setIsPromoting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const staffUsers = users.filter(u => u.role === 'staff');
  const filteredUsers = staffUsers.filter(u => {
    const search = searchTerm.toLowerCase();
    return (
      u.username.toLowerCase().includes(search) ||
      (u.email || '').toLowerCase().includes(search) ||
      (teams.find(t => t.id === u.teamId)?.name || '').toLowerCase().includes(search)
    );
  });

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const handlePromoteAll = async () => {
    if (selectedIds.length === 0) return;
    setIsPromoting(true);
    try {
      for (const id of selectedIds) {
        await api.users.update(id, { role: 'manager' } as any);
        if (onPromoted) onPromoted(id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      setSearchTerm("");
      setSelectedIds([]);
      toast({ title: "구분 관리자 배정 완료", description: `${selectedIds.length}명의 사용자가 구분 관리자로 배정되었습니다.` });
    } catch (error: any) {
      toast({ title: "배정 실패", description: error.message, variant: "destructive" });
    } finally {
      setIsPromoting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSearchTerm("");
      setSelectedIds([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-promote-manager">
          <UserPlus className="w-4 h-4" /> 구분 관리자 배정
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>구분 관리자 배정</DialogTitle>
          <DialogDescription>사용자 목록에서 구분 관리자로 배정할 사용자를 선택하세요. 여러 명을 동시에 선택할 수 있습니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이름, 이메일, 소속팀으로 검색..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-promote-search"
            />
          </div>
          {selectedIds.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {selectedIds.length}명 선택됨
            </div>
          )}
          <div className="rounded-md border max-h-[300px] overflow-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {staffUsers.length === 0 ? "배정 가능한 사용자가 없습니다. 먼저 사용자 탭에서 사용자를 추가하세요." : "검색 결과가 없습니다."}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-accent border-b last:border-b-0 ${isSelected ? 'bg-accent' : ''}`}
                    onClick={() => toggleSelection(user.id)}
                    data-testid={`promote-user-${user.id}`}
                  >
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(user.id)} className="h-4 w-4 rounded border-gray-300" />
                    <div className="flex-1 flex flex-col">
                      <span className="font-medium">{user.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {(() => { const t = teams.find(t => t.id === user.teamId); const d = t?.departmentId ? departments.find(d => d.id === t.departmentId) : null; return d ? `${d.name} / ${t?.name}` : (t?.name || "-"); })()} {user.position ? `· ${user.position}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.email && <span className="text-xs text-muted-foreground">{user.email}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handlePromoteAll}
              disabled={selectedIds.length === 0 || isPromoting}
              data-testid="button-submit-promote"
            >
              {isPromoting ? "배정 중..." : `구분 관리자로 배정 (${selectedIds.length}명)`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AssignStaffDialog({ users, categories, onAssigned, teams, departments }: { users: User[], categories: Category[], onAssigned: () => void, teams?: TeamType[], departments?: Department[] }) {
  const { currentUser } = useUser();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const unassignedStaff = users.filter(u => {
    if (u.role !== 'staff') return false;
    if (selectedCategoryId) {
      const alreadyAssignedToCategory = u.managerId === currentUser?.id && (u.assignedCategoryIds || []).includes(selectedCategoryId);
      if (alreadyAssignedToCategory) return false;
    }
    if (!u.managerId || u.managerId === currentUser?.id) {
      const search = searchTerm.toLowerCase();
      return u.username.toLowerCase().includes(search) || (u.email || '').toLowerCase().includes(search);
    }
    return false;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assignMutation = useMutation({
    mutationFn: async () => {
      const promises = Array.from(selectedIds).map(id => {
        const user = users.find(u => u.id === id);
        const existingCats = user?.assignedCategoryIds || [];
        const newCats = selectedCategoryId && !existingCats.includes(selectedCategoryId)
          ? [...existingCats, selectedCategoryId]
          : existingCats;
        return api.users.update(id, {
          managerId: currentUser?.id,
          assignedCategoryIds: newCats,
        });
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      onAssigned();
      setOpen(false);
      setSelectedIds(new Set());
      setSearchTerm("");
      setSelectedCategoryId("");
      toast({
        title: "배정 완료",
        description: `${selectedIds.size}명의 담당자가 배정되었습니다.`,
      });
    },
    onError: () => {
      toast({
        title: "배정 실패",
        description: "담당자 배정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSelectedIds(new Set());
      setSearchTerm("");
      setSelectedCategoryId("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-assign-staff">
          <UserPlus className="w-4 h-4" /> 사용자 배정
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>사용자 배정</DialogTitle>
          <DialogDescription>담당자를 선택한 구분에 배정합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {categories.length > 0 && (
            <div className="space-y-2">
              <Label>배정 구분</Label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="구분을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이름 또는 이메일로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-assign-search"
            />
          </div>
          <div className="border rounded-md max-h-[300px] overflow-auto">
            {unassignedStaff.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {selectedCategoryId ? "배정 가능한 담당자가 없습니다." : "구분을 먼저 선택해주세요."}
              </div>
            ) : (
              unassignedStaff.map(u => (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent border-b last:border-b-0 ${selectedIds.has(u.id) ? 'bg-accent' : ''}`}
                  onClick={() => toggleSelect(u.id)}
                  data-testid={`assign-user-${u.id}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(u.id)}
                    onChange={() => toggleSelect(u.id)}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{u.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {(() => { const t = teams?.find(t => t.id === u.teamId); const d = t?.departmentId && departments ? departments.find(d => d.id === t.departmentId) : null; return d ? `${d.name} / ${t?.name}` : (t?.name || ''); })()}
                      {u.email ? ` · ${u.email}` : ''}
                    </div>
                  </div>
                  {u.managerId === currentUser?.id && (
                    <Badge variant="secondary" className="text-xs">이미 배정됨</Badge>
                  )}
                  {u.position && <Badge variant="outline" className="text-xs">{u.position}</Badge>}
                </div>
              ))
            )}
          </div>
          {selectedIds.size > 0 && (
            <p className="text-sm text-muted-foreground">{selectedIds.size}명 선택됨</p>
          )}
        </div>
        <DialogFooter className="mt-2">
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={selectedIds.size === 0 || !selectedCategoryId || assignMutation.isPending}
            data-testid="button-submit-assign"
          >
            {assignMutation.isPending ? "배정 중..." : `배정 (${selectedIds.size}명)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddStaffUserDialog({ teams, onCreated, departments }: { teams: TeamType[], onCreated?: (id: string) => void, departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("__all__");
  const { register, handleSubmit, reset } = useForm();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deptFilteredTeams = selectedDeptId === "__all__" ? teams : teams.filter(t => t.departmentId === selectedDeptId);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedTeamId) {
        throw new Error("소속팀을 선택해주세요.");
      }
      return api.users.create({
        username: data.username,
        fullName: data.fullName || undefined,
        position: data.position || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        role: 'staff',
        teamId: selectedTeamId,
      });
    },
    onSuccess: (created: any) => {
      if (created?.id && onCreated) onCreated(created.id);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      reset();
      setSelectedTeamId("");
      setSelectedDeptId("__all__");
      toast({
        title: "사용자 추가 완료",
        description: "새로운 사용자 계정이 생성되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "사용자 추가 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    if (!selectedTeamId) {
      toast({
        title: "팀 선택 필요",
        description: "소속팀을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(data);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      reset();
      setSelectedTeamId("");
      setSelectedDeptId("__all__");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-staff">
          <Plus className="w-4 h-4" /> 사용자 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>사용자 추가</DialogTitle>
          <DialogDescription>사용자 계정을 추가합니다. 이메일을 입력하면 해당 이메일로 로그인할 수 있습니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff-username">이름</Label>
              <Input
                id="staff-username"
                {...register("username", { required: true })}
                placeholder="홍길동"
                data-testid="input-staff-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-position">직책</Label>
              <Input
                id="staff-position"
                {...register("position")}
                placeholder="팀장, 대리 등"
                data-testid="input-staff-position"
              />
            </div>
          </div>
          {departments.length > 0 && (
            <div className="space-y-2">
              <Label>부서</Label>
              <Select value={selectedDeptId} onValueChange={(v) => { setSelectedDeptId(v); setSelectedTeamId(""); }}>
                <SelectTrigger data-testid="select-staff-department">
                  <SelectValue placeholder="부서 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">전체 부서</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>소속 팀</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger data-testid="select-staff-team">
                <SelectValue placeholder="팀 선택" />
              </SelectTrigger>
              <SelectContent>
                {deptFilteredTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff-email">이메일 (로그인용)</Label>
              <Input
                id="staff-email"
                type="email"
                {...register("email")}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-phone">전화번호</Label>
              <Input
                id="staff-phone"
                {...register("phone")}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" data-testid="button-submit-staff">추가</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddMasterDialog({ teams, onCreated, departments }: { teams: TeamType[], onCreated?: (id: string) => void, departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("__all__");
  const { register, handleSubmit, reset } = useForm();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deptFilteredTeams = selectedDeptId === "__all__" ? teams : teams.filter(t => t.departmentId === selectedDeptId);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedTeamId) {
        throw new Error("소속팀을 선택해주세요.");
      }
      return api.users.create({
        username: data.username,
        email: data.email || undefined,
        phone: data.phone || undefined,
        role: 'admin',
        teamId: selectedTeamId,
      });
    },
    onSuccess: (created: any) => {
      if (created?.id && onCreated) onCreated(created.id);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      reset();
      setSelectedTeamId("");
      setSelectedDeptId("__all__");
      toast({ title: "마스터 추가 완료", description: "새로운 마스터 계정이 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "마스터 추가 실패", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: any) => {
    if (!selectedTeamId) {
      toast({ title: "팀 선택 필요", description: "소속팀을 선택해주세요.", variant: "destructive" });
      return;
    }
    createMutation.mutate(data);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      reset();
      setSelectedTeamId("");
      setSelectedDeptId("__all__");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-master">
          <Plus className="w-4 h-4" /> 마스터 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>마스터 추가</DialogTitle>
          <DialogDescription>시스템 최고 관리자(마스터) 계정을 추가합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="master-username">이름</Label>
            <Input
              id="master-username"
              {...register("username", { required: true })}
              placeholder="홍길동"
              data-testid="input-master-username"
            />
          </div>
          {departments.length > 0 && (
            <div className="space-y-2">
              <Label>부서</Label>
              <Select value={selectedDeptId} onValueChange={(v) => { setSelectedDeptId(v); setSelectedTeamId(""); }}>
                <SelectTrigger data-testid="select-master-department">
                  <SelectValue placeholder="부서 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">전체 부서</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>소속 팀</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger data-testid="select-master-team">
                <SelectValue placeholder="팀 선택" />
              </SelectTrigger>
              <SelectContent>
                {deptFilteredTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="master-email">이메일 (로그인용)</Label>
              <Input
                id="master-email"
                type="email"
                {...register("email")}
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="master-phone">전화번호</Label>
              <Input
                id="master-phone"
                {...register("phone")}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" data-testid="button-submit-master">추가</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTeamDialog({ team, teams, onEdit, departments }: { team: TeamType, teams: TeamType[], onEdit: (id: string, data: Partial<TeamType>) => void, departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [teamNameOpen, setTeamNameOpen] = useState(false);
  const [teamNameSearch, setTeamNameSearch] = useState(team.name);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(team.departmentId || "");
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      name: team.name,
      contactEmail: team.contactEmail,
      phone: team.phone || "",
      staffEmail: team.staffEmail || "",
      staffPhone: team.staffPhone || ""
    }
  });

  const nameValue = watch("name");

  const filteredTeamNames = teams.filter(t => 
    t.name.toLowerCase().includes(teamNameSearch.toLowerCase()) && t.id !== team.id
  );

  const onSubmit = (data: any) => {
    onEdit(team.id, { ...data, departmentId: selectedDeptId || null });
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setSelectedDeptId(team.departmentId || "");
      setTeamNameSearch(team.name);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Pencil className="mr-2 h-4 w-4" />
          수정
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>팀 정보 수정</DialogTitle>
          <DialogDescription>팀 정보를 업데이트합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-team-name">팀명</Label>
            <Popover open={teamNameOpen} onOpenChange={setTeamNameOpen}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Input
                    id="edit-team-name"
                    value={teamNameSearch}
                    onChange={(e) => {
                      setTeamNameSearch(e.target.value);
                      setValue("name", e.target.value);
                      if (!teamNameOpen) setTeamNameOpen(true);
                    }}
                    onFocus={() => setTeamNameOpen(true)}
                    placeholder="팀명 입력 또는 선택"
                    autoComplete="off"
                  />
                </div>
              </PopoverTrigger>
              {filteredTeamNames.length > 0 && (
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="max-h-[200px] overflow-auto">
                    {filteredTeamNames.map((t) => (
                      <div
                        key={t.id}
                        className="px-3 py-2 cursor-pointer hover:bg-accent text-sm"
                        onClick={() => {
                          setTeamNameSearch(t.name);
                          setValue("name", t.name);
                          setTeamNameOpen(false);
                        }}
                      >
                        {t.name}
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          </div>
          {departments.length > 0 && (
            <div className="space-y-2">
              <Label>소속 부서</Label>
              <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="부서 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">선택 안함</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">팀장 연락처</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-team-email">이메일</Label>
                <Input id="edit-team-email" {...register("contactEmail", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-team-phone">전화번호</Label>
                <Input id="edit-team-phone" {...register("phone")} placeholder="010-0000-0000" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">담당자 연락처</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-staff-email">이메일</Label>
                <Input id="edit-staff-email" {...register("staffEmail")} placeholder="staff@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-staff-phone">전화번호</Label>
                <Input id="edit-staff-phone" {...register("staffPhone")} placeholder="010-0000-0000" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }: { currentPage: number, totalItems: number, itemsPerPage: number, onPageChange: (page: number) => void }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between" data-testid="pagination">
      <p className="text-sm text-muted-foreground">
        총 {totalItems}건 중 {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalItems)}건
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0"
          data-testid="button-prev-page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {getPageNumbers().map((page, idx) => (
          typeof page === 'number' ? (
            <Button
              key={idx}
              variant={page === currentPage ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page)}
              className="h-8 w-8 p-0"
              data-testid={`button-page-${page}`}
            >
              {page}
            </Button>
          ) : (
            <span key={idx} className="px-1 text-muted-foreground">...</span>
          )
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0"
          data-testid="button-next-page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
