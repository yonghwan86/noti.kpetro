import { useState } from "react";
import { store } from "@/lib/mockData";
import { User, Role } from "@/lib/types";
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
import { Plus, Search, Trash2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Team() {
  const [users, setUsers] = useState<User[]>(store.getUsers());
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const teams = store.getTeams();

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teams.find((t) => t.id === user.teamId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteUser = (id: string) => {
    store.deleteUser(id);
    setUsers([...store.getUsers()]);
    toast({
      title: "사용자 삭제됨",
      description: "사용자가 시스템에서 제거되었습니다.",
      variant: "destructive",
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">팀 관리</h2>
          <p className="text-muted-foreground">
            사용자 계정 및 역할 권한을 관리합니다.
          </p>
        </div>
        <AddUserDialog onAdd={() => setUsers([...store.getUsers()])} />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="이름 또는 팀 검색..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={user.role === 'admin'} // Prevent deleting main admin for demo safety
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AddUserDialog({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const { toast } = useToast();
  const teams = store.getTeams();

  const onSubmit = (data: any) => {
    store.addUser({
      username: data.username,
      role: data.role,
      teamId: data.teamId,
    });
    onAdd();
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
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" /> 사용자 추가
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>사용자 추가</DialogTitle>
          <DialogDescription>
            새로운 팀원을 시스템에 등록합니다.
          </DialogDescription>
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
              <Select
                onValueChange={(v) =>
                  register("role").onChange({ target: { value: v, name: "role" } })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="역할 선택" />
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
              <Select
                onValueChange={(v) =>
                  register("teamId").onChange({ target: { value: v, name: "teamId" } })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="팀 선택" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
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
