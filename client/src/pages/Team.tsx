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
    onSuccess: () => {
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

  const filteredManagers = users.filter(
    (user) =>
      (user.role === 'manager' || user.role === 'admin') &&
      (user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teams.find((t) => t.id === user.teamId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredUsageTeams = teams.filter(
    (team) =>
      team.type === 'usage' &&
      (team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
            <AddEquipTypeDialog teams={teams} />
          </div>
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>소속팀</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>휴대폰</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredManagers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      등록된 장비 구분이 없습니다. "장비 구분 등록" 버튼을 눌러 추가하세요.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredManagers.map((user) => (
                    <TableRow key={user.id} data-testid={`row-equiptype-${user.id}`}>
                      <TableCell className="font-medium">
                        {user.username}
                        {user.fullName && <span className="text-muted-foreground text-xs ml-1">({user.fullName})</span>}
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role as Role)}</TableCell>
                      <TableCell>
                        {teams.find((t) => t.id === user.teamId)?.name || "-"}
                      </TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
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
            <p className="text-sm text-muted-foreground hidden sm:block">사용하는 팀의 팀장 및 담당자 연락처를 관리합니다.</p>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <AddUsageTeamDialog />
            </div>
          </div>
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>소속팀</TableHead>
                  <TableHead>팀장 이메일</TableHead>
                  <TableHead>팀장 휴대폰</TableHead>
                  <TableHead>담당자 이메일</TableHead>
                  <TableHead>담당자 휴대폰</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsageTeams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      사용자가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsageTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>{team.contactEmail}</TableCell>
                      <TableCell>{team.phone || "-"}</TableCell>
                      <TableCell>{team.staffEmail || "-"}</TableCell>
                      <TableCell>{team.staffPhone || "-"}</TableCell>
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
                              <EditTeamDialog team={team} teams={teams.filter(t => t.type === 'usage')} onEdit={handleEditTeam} />
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteTeam(team.id)}
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
      email: user.email || "",
      phone: user.phone || "",
      role: user.role,
      teamId: user.teamId
    }
  });
  const isAdminOrManager = user.role === 'admin' || user.role === 'manager';

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
      teamId: matchedTeam?.id || data.teamId
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
            <div className="space-y-2">
              <Label htmlFor="edit-username">이름</Label>
              <Input
                id="edit-username"
                {...register("username", { required: true })}
              />
            </div>
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
              <Label htmlFor="edit-phone">휴대폰</Label>
              <Input
                id="edit-phone"
                {...register("phone")}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-role">역할</Label>
            <Select defaultValue={user.role} onValueChange={(v) => setValue("role", v as Role)}>
              <SelectTrigger>
                <SelectValue placeholder="선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">마스터</SelectItem>
                <SelectItem value="manager">장비 관리자</SelectItem>
                <SelectItem value="staff">담당자</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit">저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddEquipTypeDialog({ teams }: { teams: TeamType[] }) {
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
    onSuccess: () => {
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
              <Label htmlFor="equip-phone">휴대폰</Label>
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
              <Label htmlFor="master-phone">휴대폰</Label>
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

function AddUsageTeamDialog() {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.teams.create({
      name: data.name,
      type: 'usage',
      contactEmail: data.contactEmail,
      phone: data.phone || undefined,
      staffEmail: data.staffEmail || undefined,
      staffPhone: data.staffPhone || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setOpen(false);
      reset();
      toast({
        title: "사용자 추가됨",
        description: "새로운 사용자 팀이 생성되었습니다.",
      });
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" /> 사용자 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>사용자 추가</DialogTitle>
          <DialogDescription>장비를 사용하는 팀을 추가합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usage-team-name">소속팀</Label>
            <Input
              id="usage-team-name"
              {...register("name", { required: true })}
              placeholder="예: 생산1팀"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">팀장 연락처</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="usage-leader-email">이메일</Label>
                <Input
                  id="usage-leader-email"
                  type="email"
                  {...register("contactEmail", { required: true })}
                  placeholder="leader@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="usage-leader-phone">휴대폰</Label>
                <Input
                  id="usage-leader-phone"
                  {...register("phone")}
                  placeholder="010-0000-0000"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">담당자 연락처</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="usage-staff-email">이메일</Label>
                <Input
                  id="usage-staff-email"
                  type="email"
                  {...register("staffEmail")}
                  placeholder="staff@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="usage-staff-phone">휴대폰</Label>
                <Input
                  id="usage-staff-phone"
                  {...register("staffPhone")}
                  placeholder="010-0000-0000"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit">생성</Button>
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
                <Label htmlFor="edit-team-phone">휴대폰</Label>
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
                <Label htmlFor="edit-staff-phone">휴대폰</Label>
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
