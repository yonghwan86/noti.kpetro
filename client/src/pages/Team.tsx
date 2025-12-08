import { useState, useEffect } from "react";
import { store } from "@/lib/mockData";
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
import { Plus, Search, Trash2, UserPlus, Users, Pencil, MoreHorizontal } from "lucide-react";
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

export default function Team() {
  const [users, setUsers] = useState<User[]>(store.getUsers());
  const [teams, setTeams] = useState<TeamType[]>(store.getTeams());
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setUsers([...store.getUsers()]);
      setTeams([...store.getTeams()]);
    });
    return unsubscribe;
  }, []);

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teams.find((t) => t.id === user.teamId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteUser = (id: string) => {
    store.deleteUser(id);
    toast({
      title: "사용자 삭제됨",
      description: "사용자가 시스템에서 제거되었습니다.",
      variant: "destructive",
    });
  };

  const handleDeleteTeam = (id: string) => {
    store.deleteTeam(id);
    toast({
      title: "팀 삭제됨",
      description: "팀이 시스템에서 제거되었습니다.",
      variant: "destructive",
    });
  };

  const handleEditTeam = (id: string, data: Partial<TeamType>) => {
    store.updateTeam(id, data);
    toast({
      title: "팀 수정됨",
      description: "팀 정보가 업데이트되었습니다.",
    });
  };

  const handleEditUser = (id: string, data: Partial<User>) => {
    store.updateUser(id, data);
    toast({
      title: "사용자 수정됨",
      description: "사용자 정보가 업데이트되었습니다.",
    });
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-purple-500 hover:bg-purple-600">슈퍼 관리자</Badge>;
      case "manager":
        return <Badge className="bg-blue-500 hover:bg-blue-600">팀장</Badge>;
      case "staff":
        return <Badge variant="secondary">팀원</Badge>;
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

      <Tabs defaultValue="users" className="space-y-4">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="users" className="gap-2"><UserPlus className="w-4 h-4"/> 사용자</TabsTrigger>
            <TabsTrigger value="teams" className="gap-2"><Users className="w-4 h-4"/> 팀</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
             <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="검색..."
                className="pl-8 h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <AddUserDialog teams={teams} />
            <AddTeamDialog />
          </div>
        </div>

        <TabsContent value="users" className="space-y-4">
          <div className="rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">프로필</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>소속 팀</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      사용자가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
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
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        {teams.find((t) => t.id === user.teamId)?.name || "Unknown"}
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

        <TabsContent value="teams" className="space-y-4">
          <div className="rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>팀명</TableHead>
                  <TableHead>연락처 이메일</TableHead>
                  <TableHead>소속 인원</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      팀이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>{team.contactEmail}</TableCell>
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
                              <EditTeamDialog team={team} onEdit={handleEditTeam} />
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
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      username: user.username,
      role: user.role,
      teamId: user.teamId
    }
  });

  const onSubmit = (data: any) => {
    onEdit(user.id, data);
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
          <DialogTitle>사용자 정보 수정</DialogTitle>
          <DialogDescription>사용자 정보를 업데이트합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-username">이름</Label>
            <Input
              id="edit-username"
              {...register("username", { required: true })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role">역할</Label>
              <Select defaultValue={user.role} onValueChange={(v) => register("role").onChange({ target: { value: v, name: "role" } })}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">슈퍼 관리자</SelectItem>
                  <SelectItem value="manager">팀장</SelectItem>
                  <SelectItem value="staff">팀원</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team">소속 팀</Label>
              <Select defaultValue={user.teamId} onValueChange={(v) => register("teamId").onChange({ target: { value: v, name: "teamId" } })}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

function AddUserDialog({ teams }: { teams: TeamType[] }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const { toast } = useToast();

  const onSubmit = (data: any) => {
    store.addUser({
      username: data.username,
      role: data.role,
      teamId: data.teamId,
    });
    setOpen(false);
    reset();
    toast({
      title: "사용자 추가됨",
      description: "새로운 사용자가 등록되었습니다.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <div className="space-y-2">
            <Label htmlFor="username">이름</Label>
            <Input
              id="username"
              {...register("username", { required: true })}
              placeholder="홍길동"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">역할</Label>
              <Select onValueChange={(v) => register("role").onChange({ target: { value: v, name: "role" } })}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">슈퍼 관리자</SelectItem>
                  <SelectItem value="manager">팀장</SelectItem>
                  <SelectItem value="staff">팀원</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="team">소속 팀</Label>
              <Select onValueChange={(v) => register("teamId").onChange({ target: { value: v, name: "teamId" } })}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
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

function AddTeamDialog() {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const { toast } = useToast();

  const onSubmit = (data: any) => {
    store.addTeam({
      name: data.name,
      contactEmail: data.contactEmail,
    });
    setOpen(false);
    reset();
    toast({
      title: "팀 추가됨",
      description: "새로운 팀이 생성되었습니다.",
    });
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
          <div className="space-y-2">
            <Label htmlFor="team-email">연락처 이메일</Label>
            <Input
              id="team-email"
              type="email"
              {...register("contactEmail", { required: true })}
              placeholder="team@example.com"
            />
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit">생성</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTeamDialog({ team, onEdit }: { team: TeamType, onEdit: (id: string, data: Partial<TeamType>) => void }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: team.name,
      contactEmail: team.contactEmail
    }
  });

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
            <Input id="edit-team-name" {...register("name", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-team-email">연락처 이메일</Label>
            <Input id="edit-team-email" {...register("contactEmail", { required: true })} />
          </div>
          <DialogFooter>
            <Button type="submit">저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
