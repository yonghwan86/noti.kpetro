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
import { Plus, Search, Trash2, UserPlus, Users, Pencil, MoreHorizontal, ShieldAlert, KeyRound, Download, Upload } from "lucide-react";
import ExcelImportDialog from "@/components/ExcelImportDialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  if (!auth.canManageTeams(currentUser)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <CardTitle>접근 권한이 없습니다</CardTitle>
            <CardDescription>
              팀 및 사용자 관리는 마스터 권한이 필요합니다. 
              필요한 경우 시스템 관리자에게 문의하세요.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const filteredAdmins = users.filter(
    (user) =>
      (user.role === 'admin' || user.role === 'manager') &&
      (user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teams.find((t) => t.id === user.teamId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredStaff = users.filter(
    (user) =>
      user.role === 'staff' &&
      (user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teams.find((t) => t.id === user.teamId)?.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
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
        <h2 className="text-2xl font-bold tracking-tight">팀 및 사용자 관리</h2>
        <p className="text-muted-foreground">
          팀 구조와 사용자 계정 권한을 관리합니다.
        </p>
      </div>

      <Tabs defaultValue="teams" className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="teams" className="gap-2"><Users className="w-4 h-4"/> 팀</TabsTrigger>
            <TabsTrigger value="staff" className="gap-2"><UserPlus className="w-4 h-4"/> 사용자</TabsTrigger>
            <TabsTrigger value="admins" className="gap-2"><ShieldAlert className="w-4 h-4"/> 관리자</TabsTrigger>
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

        <TabsContent value="teams" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <p className="text-sm text-muted-foreground hidden sm:block">해당 팀장님의 이메일과 휴대폰으로 등록해주시길 바랍니다.</p>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="gap-2 flex-1 sm:flex-none" asChild>
                <a href="/api/teams/export" download>
                  <Download className="h-4 w-4" />
                  다운로드
                </a>
              </Button>
              <ExcelImportDialog
                title="팀 엑셀 업로드"
                description="엑셀 파일에서 팀 목록을 일괄 등록합니다."
                templateUrl="/api/teams/template"
                importUrl="/api/teams/import"
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/teams"] })}
              />
              <AddTeamDialog />
            </div>
          </div>
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>팀명</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>휴대폰</TableHead>
                  <TableHead>소속 인원</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      팀이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>{team.contactEmail}</TableCell>
                      <TableCell>{team.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {users.filter(u => u.teamId === team.id).length} 명
                        </Badge>
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
                              <EditTeamDialog team={team} teams={teams} onEdit={handleEditTeam} />
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

        <TabsContent value="admins" className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="/api/users/export" download>
                <Download className="h-4 w-4" />
                다운로드
              </a>
            </Button>
            <ExcelImportDialog
              title="사용자 엑셀 업로드"
              description="엑셀 파일에서 사용자 목록을 일괄 등록합니다. 역할은 '마스터', '장비관리자', '담당자' 중 하나로 입력하세요."
              templateUrl="/api/users/template"
              importUrl="/api/users/import"
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/users"] })}
            />
            <AddAdminDialog teams={teams} />
          </div>
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">프로필</TableHead>
                  <TableHead>관리 장비명</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>소속 팀</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>휴대폰</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdmins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      관리자가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAdmins.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          <AvatarImage
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                            alt={user.username}
                          />
                          <AvatarFallback>{user.username[0]}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.fullName || "-"}</TableCell>
                      <TableCell>
                        {teams.find((t) => t.id === user.teamId)?.name || "Unknown"}
                      </TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>{user.phone || "-"}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
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
                              <DropdownMenuItem 
                                onClick={() => handleResetPassword(user.id, user.username)}
                              >
                                <KeyRound className="mr-2 h-4 w-4" />
                                비밀번호 초기화
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteUser(user.id)}
                                disabled={user.role === 'admin'}
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

        <TabsContent value="staff" className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href="/api/users/export" download>
                <Download className="h-4 w-4" />
                다운로드
              </a>
            </Button>
            <ExcelImportDialog
              title="사용자 엑셀 업로드"
              description="엑셀 파일에서 사용자 목록을 일괄 등록합니다."
              templateUrl="/api/users/template"
              importUrl="/api/users/import"
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/users"] })}
            />
            <AddStaffDialog teams={teams} />
          </div>
          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">프로필</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>소속 팀</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>휴대폰</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      사용자가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-9 w-9">
                          <AvatarImage
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                            alt={user.username}
                          />
                          <AvatarFallback>{user.username[0]}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>
                        {teams.find((t) => t.id === user.teamId)?.name || "Unknown"}
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
                              <DropdownMenuItem 
                                onClick={() => handleResetPassword(user.id, user.username)}
                              >
                                <KeyRound className="mr-2 h-4 w-4" />
                                비밀번호 초기화
                              </DropdownMenuItem>
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
                <Label htmlFor="edit-username">관리 장비명</Label>
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

function AddUserDialog({ teams }: { teams: TeamType[] }) {
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
      email: data.email || undefined,
      phone: data.phone || undefined,
      role: data.role,
      teamId: data.teamId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      reset();
      toast({
        title: "사용자 추가됨",
        description: "새로운 사용자가 등록되었습니다.",
      });
    },
  });

  const onSubmit = (data: any) => {
    const matchedTeam = teams.find(t => t.name === teamInput);
    if (!matchedTeam && !data.teamId) {
      toast({
        title: "팀 선택 필요",
        description: "목록에서 팀을 선택해주세요.",
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
        <Button className="gap-2" variant="outline">
          <UserPlus className="w-4 h-4" /> 사용자 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>사용자 추가</DialogTitle>
          <DialogDescription>새로운 팀원을 등록합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">이름</Label>
              <Input
                id="username"
                {...register("username", { required: true })}
                placeholder="홍길동"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">역할</Label>
              <Select onValueChange={(v) => setValue("role", v)}>
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">휴대폰</Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <div className="space-y-2 relative">
            <Label htmlFor="team">소속 팀</Label>
            <Input
              id="team"
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
          <DialogFooter className="mt-4">
            <Button type="submit">등록</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddAdminDialog({ teams }: { teams: TeamType[] }) {
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
      role: data.role,
      teamId: data.teamId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      reset();
      setTeamInput("");
      toast({
        title: "관리자 추가됨",
        description: "새로운 관리자가 등록되었습니다.",
      });
    },
  });

  const onSubmit = (data: any) => {
    const matchedTeam = teams.find(t => t.name === teamInput);
    if (!matchedTeam && !data.teamId) {
      toast({
        title: "팀 선택 필요",
        description: "목록에서 팀을 선택해주세요.",
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
        <Button className="gap-2" variant="outline">
          <Plus className="w-4 h-4" /> 관리자 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>관리자 추가</DialogTitle>
          <DialogDescription>마스터 또는 장비 관리자를 등록합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-username">관리 장비명</Label>
              <Input
                id="admin-username"
                {...register("username", { required: true })}
                placeholder="계량기, 차량 등"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-fullname">이름</Label>
              <Input
                id="admin-fullname"
                {...register("fullName")}
                placeholder="홍길동"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="admin-team">소속 팀</Label>
              <Input
                id="admin-team"
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
            <div className="space-y-2">
              <Label htmlFor="admin-email">이메일</Label>
              <Input
                id="admin-email"
                type="email"
                {...register("email")}
                placeholder="user@example.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-phone">휴대폰</Label>
              <Input
                id="admin-phone"
                {...register("phone")}
                placeholder="010-0000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-role">역할</Label>
              <Select onValueChange={(v) => setValue("role", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">마스터</SelectItem>
                  <SelectItem value="manager">장비 관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit">등록</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddStaffDialog({ teams }: { teams: TeamType[] }) {
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
      email: data.email || undefined,
      phone: data.phone || undefined,
      role: "staff",
      teamId: data.teamId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setOpen(false);
      reset();
      toast({
        title: "사용자 추가됨",
        description: "새로운 담당자가 등록되었습니다.",
      });
    },
  });

  const onSubmit = (data: any) => {
    const matchedTeam = teams.find(t => t.name === teamInput);
    if (!matchedTeam && !data.teamId) {
      toast({
        title: "팀 선택 필요",
        description: "목록에서 팀을 선택해주세요.",
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
        <Button className="gap-2" variant="outline">
          <UserPlus className="w-4 h-4" /> 사용자 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>사용자 추가</DialogTitle>
          <DialogDescription>새로운 담당자를 등록합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-username">이름</Label>
            <Input
              id="staff-username"
              {...register("username", { required: true })}
              placeholder="홍길동"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff-email">이메일</Label>
              <Input
                id="staff-email"
                type="email"
                {...register("email")}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-phone">휴대폰</Label>
              <Input
                id="staff-phone"
                {...register("phone")}
                placeholder="010-0000-0000"
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
          <DialogFooter className="mt-4">
            <Button type="submit">등록</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddTeamDialog() {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: any) => api.teams.create({
      name: data.name,
      contactEmail: data.contactEmail,
      phone: data.phone || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setOpen(false);
      reset();
      toast({
        title: "팀 추가됨",
        description: "새로운 팀이 생성되었습니다.",
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
          <Plus className="w-4 h-4" /> 팀 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>팀 추가</DialogTitle>
          <DialogDescription>새로운 부서나 팀을 생성합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">팀명</Label>
            <Input
              id="team-name"
              {...register("name", { required: true })}
              placeholder="예: 시설관리팀"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="team-email">이메일</Label>
              <Input
                id="team-email"
                type="email"
                {...register("contactEmail", { required: true })}
                placeholder="team@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-phone">휴대폰</Label>
              <Input
                id="team-phone"
                {...register("phone")}
                placeholder="010-0000-0000"
              />
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
      phone: team.phone || ""
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
          <DialogFooter>
            <Button type="submit">저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
