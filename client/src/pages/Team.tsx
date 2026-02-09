import { useState } from "react";
import { User, Role, Team as TeamType } from "@/lib/types";
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
import { Plus, Search, Trash2, UserPlus, Users, Pencil, MoreHorizontal, ShieldAlert, KeyRound, Download, Upload, Tags, Shield } from "lucide-react";
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

  const filteredManagers = sortRecent(users.filter(
    (user) =>
      (user.role === 'manager' || user.role === 'admin') &&
      (user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teams.find((t) => t.id === user.teamId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
  ));

  const filteredStaffUsers = sortRecent(users.filter(
    (user) => {
      if (user.role !== 'staff') return false;
      if (isManager && currentUser) {
        if (user.managerId !== currentUser.id) return false;
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

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-purple-500 hover:bg-purple-600">마스터</Badge>;
      case "manager":
        return <Badge className="bg-blue-500 hover:bg-blue-600">장비 관리자</Badge>;
      case "staff":
        return <Badge variant="secondary">담당자</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">관리</h2>
        <p className="text-muted-foreground">
          장비 구분과 사용자를 관리합니다.
        </p>
      </div>

      <Tabs defaultValue={isAdmin ? "equipTypes" : "staff"} className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <TabsList className="w-full sm:w-auto">
            {isAdmin && (
              <TabsTrigger value="equipTypes" className="gap-2"><Tags className="w-4 h-4"/> 장비 구분</TabsTrigger>
            )}
            <TabsTrigger value="staff" className="gap-2"><UserPlus className="w-4 h-4"/> 사용자</TabsTrigger>
            {isAdmin && <AddMasterAccountDialog teams={teams} />}
          </TabsList>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="검색..."
              className="pl-8 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {isAdmin && <TabsContent value="equipTypes" className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="/api/users/export" download>
                <Download className="h-4 w-4" />
                다운로드
              </a>
            </Button>
            <ExcelImportDialog
              title="장비 구분 엑셀 업로드"
              description="엑셀 파일에서 장비 구분 목록을 일괄 등록합니다."
              templateUrl="/api/users/template"
              importUrl="/api/users/import"
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/users"] })}
            />
            <AddEquipTypeDialog teams={teams} onCreated={pushRecentUser} />
          </div>
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>역할</TableHead>
                  <TableHead>구분</TableHead>
                  <TableHead>소속팀</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>로그인</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredManagers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      등록된 장비 구분이 없습니다. "장비 구분 등록" 버튼을 눌러 추가하세요.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredManagers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-equiptype-${user.id}`}>
                      <TableCell>{getRoleBadge(user.role as Role)}</TableCell>
                      <TableCell className="font-medium">
                        {user.username}
                        {user.fullName && <span className="text-muted-foreground text-xs ml-1">({user.fullName})</span>}
                      </TableCell>
                      <TableCell>
                        {teams.find((t) => t.id === user.teamId)?.name || "-"}
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
                              <EditUserDialog user={user} teams={teams} onEdit={handleEditUser} />
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteUser(user.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                삭제
                              </DropdownMenuItem>
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
        </TabsContent>}

        <TabsContent value="staff" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">
              {isAdmin 
                ? "회사 직원(담당자) 계정을 등록하고 관리합니다." 
                : "내 장비에 배정된 담당자 목록입니다. '사용자 배정' 버튼으로 담당자를 추가할 수 있습니다."}
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
                  <AddStaffUserDialog teams={teams} onCreated={pushRecentUser} />
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
                  <AssignStaffDialog users={users} onAssigned={() => queryClient.invalidateQueries({ queryKey: ["/api/users"] })} />
                </>
              )}
            </div>
          </div>
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>직책</TableHead>
                  <TableHead>소속팀</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>로그인</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaffUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      {isAdmin 
                        ? '등록된 사용자가 없습니다. "사용자 추가" 버튼을 눌러 추가하세요.'
                        : '배정된 담당자가 없습니다. "사용자 배정" 버튼을 눌러 추가하세요.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaffUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-staff-${user.id}`}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.position || "-"}</TableCell>
                      <TableCell>
                        {teams.find((t) => t.id === user.teamId)?.name || "-"}
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
                              <EditUserDialog user={user} teams={teams} onEdit={handleEditUser} />
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
                                    onClick={() => handleEditUser(user.id, { managerId: null })}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EditUserDialog({ user, teams, onEdit }: { user: User, teams: TeamType[], onEdit: (id: string, data: Partial<User>) => void }) {
  const [open, setOpen] = useState(false);
  const [teamInput, setTeamInput] = useState(teams.find(t => t.id === user.teamId)?.name || "");
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      username: user.username,
      fullName: user.fullName || "",
      position: user.position || "",
      email: user.email || "",
      phone: user.phone || "",
      teamId: user.teamId,
    }
  });
  const isAdminOrManager = user.role === 'admin' || user.role === 'manager';
  const isStaffUser = user.role === 'staff';

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(teamInput.toLowerCase())
  );

  const onSubmit = (data: any) => {
    const matchedTeam = teams.find(t => t.name === teamInput);
    if (!matchedTeam && !data.teamId) {
      return;
    }
    const submitData = {
      ...data,
      teamId: matchedTeam?.id || data.teamId,
    };
    onEdit(user.id, submitData);
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setTeamInput(teams.find(t => t.id === user.teamId)?.name || "");
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
          {isAdminOrManager ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-username">장비 구분</Label>
                <Input
                  id="edit-username"
                  {...register("username", { required: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-fullName">이름</Label>
                <Input
                  id="edit-fullName"
                  {...register("fullName")}
                  placeholder="실제 이름"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-username">이름</Label>
                  <Input
                    id="edit-username"
                    {...register("username", { required: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-position">직책</Label>
                  <Input
                    id="edit-position"
                    {...register("position")}
                    placeholder="팀장, 대리 등"
                  />
                </div>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="edit-team">소속 팀</Label>
              <Input
                id="edit-team"
                value={teamInput}
                onChange={(e) => {
                  setTeamInput(e.target.value);
                  setShowTeamSuggestions(true);
                }}
                onFocus={() => setShowTeamSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTeamSuggestions(false), 200)}
                placeholder="팀 이름 입력 또는 선택"
              />
              {showTeamSuggestions && filteredTeams.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-auto">
                  {filteredTeams.map((t) => (
                    <div
                      key={t.id}
                      className="px-3 py-2 cursor-pointer hover:bg-accent"
                      onMouseDown={() => {
                        setTeamInput(t.name);
                        setValue("teamId", t.id);
                        setShowTeamSuggestions(false);
                      }}
                    >
                      {t.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
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

function AddEquipTypeDialog({ teams, onCreated }: { teams: TeamType[], onCreated?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [teamInput, setTeamInput] = useState("");
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  const { register, handleSubmit, reset, setValue } = useForm();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(teamInput.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: (data: any) => api.users.create({
      username: data.username,
      fullName: data.fullName || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      role: 'manager',
      teamId: data.teamId,
    }),
    onSuccess: (created: any) => {
      if (created?.id && onCreated) onCreated(created.id);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      reset();
      setTeamInput("");
      toast({
        title: "장비 구분 등록 완료",
        description: "새로운 장비 구분이 등록되었습니다.",
      });
    },
  });

  const onSubmit = (data: any) => {
    const matchedTeam = teams.find(t => t.name === teamInput);
    if (!matchedTeam && !data.teamId) {
      toast({
        title: "팀 선택 필요",
        description: "목록에서 소속팀을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    const submitData = {
      ...data,
      teamId: matchedTeam?.id || data.teamId
    };
    createMutation.mutate(submitData);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTeamInput("");
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-equiptype">
          <Plus className="w-4 h-4" /> 장비 구분 등록
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>장비 구분 등록</DialogTitle>
          <DialogDescription>장비 구분을 먼저 등록한 뒤, 장비 관리 페이지에서 해당 구분에 장비를 등록할 수 있습니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="equip-type-name">장비 구분명</Label>
              <Input
                id="equip-type-name"
                {...register("username", { required: true })}
                placeholder="검사장비, 차량 등"
                data-testid="input-equiptype-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equip-manager-name">관리자명</Label>
              <Input
                id="equip-manager-name"
                {...register("fullName")}
                placeholder="홍길동"
                data-testid="input-equiptype-manager"
              />
            </div>
          </div>
          <div className="space-y-2 relative">
            <Label htmlFor="equip-team">소속 팀</Label>
            <Input
              id="equip-team"
              value={teamInput}
              onChange={(e) => {
                setTeamInput(e.target.value);
                setShowTeamSuggestions(true);
              }}
              onFocus={() => setShowTeamSuggestions(true)}
              onBlur={() => setTimeout(() => setShowTeamSuggestions(false), 200)}
              placeholder="팀 이름 입력 또는 선택"
              data-testid="input-equiptype-team"
            />
            {showTeamSuggestions && filteredTeams.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-auto">
                {filteredTeams.map((t) => (
                  <div
                    key={t.id}
                    className="px-3 py-2 cursor-pointer hover:bg-accent"
                    onMouseDown={() => {
                      setTeamInput(t.name);
                      setValue("teamId", t.id);
                      setShowTeamSuggestions(false);
                    }}
                  >
                    {t.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="equip-email">이메일</Label>
              <Input
                id="equip-email"
                type="email"
                {...register("email")}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equip-phone">전화번호</Label>
              <Input
                id="equip-phone"
                {...register("phone")}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" data-testid="button-submit-equiptype">등록</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddMasterAccountDialog({ teams }: { teams: TeamType[] }) {
  const [open, setOpen] = useState(false);
  const [teamInput, setTeamInput] = useState("");
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  const { register, handleSubmit, reset, setValue } = useForm();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(teamInput.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: (data: any) => api.users.create({
      username: data.username,
      fullName: data.fullName || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      role: 'admin',
      teamId: data.teamId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      reset();
      setTeamInput("");
      toast({
        title: "마스터 계정 생성 완료",
        description: "새로운 마스터 계정이 생성되었습니다.",
      });
    },
  });

  const onSubmit = (data: any) => {
    const matchedTeam = teams.find(t => t.name === teamInput);
    if (!matchedTeam && !data.teamId) {
      toast({
        title: "팀 선택 필요",
        description: "목록에서 소속팀을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    const submitData = {
      ...data,
      teamId: matchedTeam?.id || data.teamId
    };
    createMutation.mutate(submitData);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTeamInput("");
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 gap-2 hover:bg-accent hover:text-accent-foreground"
          data-testid="button-add-master"
        >
          <Shield className="w-4 h-4" /> 마스터 계정 추가
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>마스터 계정 추가</DialogTitle>
          <DialogDescription>시스템 전체를 관리할 수 있는 마스터 계정을 추가합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="master-username">이름</Label>
              <Input
                id="master-username"
                {...register("username", { required: true })}
                placeholder="홍길동"
                data-testid="input-master-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="master-fullname">표시 이름</Label>
              <Input
                id="master-fullname"
                {...register("fullName")}
                placeholder="관리자"
                data-testid="input-master-fullname"
              />
            </div>
          </div>
          <div className="space-y-2 relative">
            <Label htmlFor="master-team">소속 팀</Label>
            <Input
              id="master-team"
              value={teamInput}
              onChange={(e) => {
                setTeamInput(e.target.value);
                setShowTeamSuggestions(true);
              }}
              onFocus={() => setShowTeamSuggestions(true)}
              onBlur={() => setTimeout(() => setShowTeamSuggestions(false), 200)}
              placeholder="팀 이름 입력 또는 선택"
              data-testid="input-master-team"
            />
            {showTeamSuggestions && filteredTeams.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-auto">
                {filteredTeams.map((t) => (
                  <div
                    key={t.id}
                    className="px-3 py-2 cursor-pointer hover:bg-accent"
                    onMouseDown={() => {
                      setTeamInput(t.name);
                      setValue("teamId", t.id);
                      setShowTeamSuggestions(false);
                    }}
                  >
                    {t.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="master-email">이메일</Label>
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
            <Button type="submit" data-testid="button-submit-master">생성</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignStaffDialog({ users, onAssigned }: { users: User[], onAssigned: () => void }) {
  const { currentUser } = useUser();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const unassignedStaff = users.filter(u => 
    u.role === 'staff' && !u.managerId &&
    (u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
      const promises = Array.from(selectedIds).map(id =>
        api.users.update(id, { managerId: currentUser?.id })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      onAssigned();
      setOpen(false);
      setSelectedIds(new Set());
      setSearchTerm("");
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
          <DialogDescription>미배정 담당자를 내 장비에 배정합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
                미배정 담당자가 없습니다.
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
                    <div className="text-xs text-muted-foreground">{u.email || '이메일 없음'}</div>
                  </div>
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
            disabled={selectedIds.size === 0 || assignMutation.isPending}
            data-testid="button-submit-assign"
          >
            {assignMutation.isPending ? "배정 중..." : `배정 (${selectedIds.size}명)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddStaffUserDialog({ teams, onCreated }: { teams: TeamType[], onCreated?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [teamInput, setTeamInput] = useState("");
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  const { register, handleSubmit, reset, setValue } = useForm();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(teamInput.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: (data: any) => api.users.create({
      username: data.username,
      fullName: data.fullName || undefined,
      position: data.position || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      role: 'staff',
      teamId: data.teamId,
    }),
    onSuccess: (created: any) => {
      if (created?.id && onCreated) onCreated(created.id);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      reset();
      setTeamInput("");
      toast({
        title: "사용자 추가 완료",
        description: "새로운 사용자 계정이 생성되었습니다. 이메일이 등록되어 있으면 로그인할 수 있습니다.",
      });
    },
  });

  const onSubmit = (data: any) => {
    const matchedTeam = teams.find(t => t.name === teamInput);
    if (!matchedTeam && !data.teamId) {
      toast({
        title: "팀 선택 필요",
        description: "목록에서 소속팀을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    const submitData = {
      ...data,
      teamId: matchedTeam?.id || data.teamId,
    };
    createMutation.mutate(submitData);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTeamInput("");
      reset();
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
          <DialogDescription>장비를 사용하는 담당자 계정을 추가합니다. 이메일을 입력하면 해당 이메일로 로그인할 수 있습니다.</DialogDescription>
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
          <div className="space-y-2 relative">
            <Label htmlFor="staff-team">소속 팀</Label>
            <Input
              id="staff-team"
              value={teamInput}
              onChange={(e) => {
                setTeamInput(e.target.value);
                setShowTeamSuggestions(true);
              }}
              onFocus={() => setShowTeamSuggestions(true)}
              onBlur={() => setTimeout(() => setShowTeamSuggestions(false), 200)}
              placeholder="팀 이름 입력 또는 선택"
              data-testid="input-staff-team"
            />
            {showTeamSuggestions && filteredTeams.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-auto">
                {filteredTeams.map((t) => (
                  <div
                    key={t.id}
                    className="px-3 py-2 cursor-pointer hover:bg-accent"
                    onMouseDown={() => {
                      setTeamInput(t.name);
                      setValue("teamId", t.id);
                      setShowTeamSuggestions(false);
                    }}
                  >
                    {t.name}
                  </div>
                ))}
              </div>
            )}
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

function EditTeamDialog({ team, teams, onEdit }: { team: TeamType, teams: TeamType[], onEdit: (id: string, data: Partial<TeamType>) => void }) {
  const [open, setOpen] = useState(false);
  const [teamNameOpen, setTeamNameOpen] = useState(false);
  const [teamNameSearch, setTeamNameSearch] = useState(team.name);
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
    onEdit(team.id, data);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
