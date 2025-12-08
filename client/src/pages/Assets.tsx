import { useState } from "react";
import { store, TEAMS } from "@/lib/mockData";
import { Asset, AssetStatus, Category } from "@/lib/types";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { 
  CalendarIcon, 
  Filter, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Pencil,
  Trash2,
  MoreHorizontal,
  Tags
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";

// Helper functions defined outside to be accessible by all components in this file
const getTeamName = (id: string) => TEAMS.find(t => t.id === id)?.name || id;

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>(store.getAssets());
  const [categories, setCategories] = useState<Category[]>(store.getCategories());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const { toast } = useToast();

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || asset.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || id;

  const getStatusBadge = (status: AssetStatus) => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-status-ok hover:bg-status-ok/90 text-white border-0"><CheckCircle2 className="w-3 h-3 mr-1" /> 정상</Badge>;
      case 'upcoming':
        return <Badge className="bg-status-warning hover:bg-status-warning/90 text-white border-0"><Clock className="w-3 h-3 mr-1" /> 임박</Badge>;
      case 'overdue':
        return <Badge className="bg-status-error hover:bg-status-error/90 text-white border-0"><AlertCircle className="w-3 h-3 mr-1" /> 지연</Badge>;
    }
  };

  const handleInspect = (id: string, date: Date) => {
    const updated = store.updateAssetInspection(id, format(date, 'yyyy-MM-dd'));
    if (updated) {
      setAssets([...store.getAssets()]); // Refresh list
      toast({
        title: "점검 기록 완료",
        description: `다음 점검 예정일이 계산되었습니다: ${updated.nextDueDate}`,
      });
    }
  };

  const handleDelete = (id: string) => {
    store.deleteAsset(id);
    setAssets([...store.getAssets()]);
    toast({
      title: "장비 삭제 완료",
      description: "장비가 목록에서 제거되었습니다.",
      variant: "destructive"
    });
  };

  const handleEdit = (id: string, data: Partial<Asset>) => {
    store.updateAsset(id, data);
    setAssets([...store.getAssets()]);
    toast({
      title: "장비 수정 완료",
      description: "장비 정보가 업데이트되었습니다."
    });
  };

  const refreshCategories = () => {
    setCategories([...store.getCategories()]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">장비 관리</h2>
          <p className="text-muted-foreground">장비의 교정 및 점검 상태를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
            <ManageCategoriesDialog onUpdate={refreshCategories} categories={categories} />
            <AddAssetDialog onAdd={() => setAssets([...store.getAssets()])} categories={categories} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="장비 검색..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="ok">정상</SelectItem>
            <SelectItem value="upcoming">임박</SelectItem>
            <SelectItem value="overdue">지연</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>장비명</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>관리 팀</TableHead>
              <TableHead>최근 점검일</TableHead>
              <TableHead>다음 예정일</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
               <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  등록된 장비가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>
                    <div className="font-medium">{asset.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{asset.serialNumber}</div>
                  </TableCell>
                  <TableCell>{getCategoryName(asset.categoryId)}</TableCell>
                  <TableCell>{getTeamName(asset.teamId)}</TableCell>
                  <TableCell>{format(new Date(asset.lastInspectedDate), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="font-medium">
                    {format(new Date(asset.nextDueDate), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>{getStatusBadge(asset.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <InspectDialog asset={asset} onInspect={handleInspect} />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>작업</DropdownMenuLabel>
                          <EditAssetDialog asset={asset} onEdit={handleEdit} categories={categories} />
                          <DropdownMenuSeparator />
                          <DeleteAssetDialog asset={asset} onDelete={handleDelete} />
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
    </div>
  );
}

function ManageCategoriesDialog({ onUpdate, categories }: { onUpdate: () => void, categories: Category[] }) {
  const [newCategory, setNewCategory] = useState("");
  const { toast } = useToast();

  const handleAdd = () => {
    if (newCategory.trim()) {
      store.addCategory(newCategory);
      setNewCategory("");
      onUpdate();
      toast({ title: "카테고리 추가됨", description: `"${newCategory}" 카테고리가 추가되었습니다.` });
    }
  };

  const handleDelete = (id: string) => {
    store.deleteCategory(id);
    onUpdate();
    toast({ title: "카테고리 삭제됨", description: "카테고리가 삭제되었습니다.", variant: "destructive" });
  };

  const handleEdit = (id: string, name: string) => {
    store.updateCategory(id, name);
    onUpdate();
    toast({ title: "카테고리 수정됨", description: "카테고리 이름이 변경되었습니다." });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Tags className="w-4 h-4" /> 카테고리 관리
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>카테고리 관리</DialogTitle>
          <DialogDescription>
            장비 분류 카테고리를 추가하거나 삭제합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <Input 
              placeholder="새 카테고리 이름" 
              value={newCategory} 
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Button onClick={handleAdd} disabled={!newCategory.trim()}>추가</Button>
          </div>
          <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
            {categories.map((category) => (
              <CategoryItem 
                key={category.id} 
                category={category} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryItem({ category, onEdit, onDelete }: { category: Category, onEdit: (id: string, name: string) => void, onDelete: (id: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);

  const handleSave = () => {
    if (editName.trim()) {
      onEdit(category.id, editName);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-2 px-3">
        <Input 
          value={editName} 
          onChange={(e) => setEditName(e.target.value)}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={handleSave} className="h-8 px-2">저장</Button>
        <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-8 px-2">취소</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-2 px-3 text-sm">
      <span>{category.name}</span>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => setIsEditing(true)}>
          <Pencil className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(category.id)}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function InspectDialog({ asset, onInspect }: { asset: Asset, onInspect: (id: string, date: Date) => void }) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">점검</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>점검 기록</DialogTitle>
          <DialogDescription>
            <strong>{asset.name}</strong>의 점검일을 업데이트합니다. {asset.inspectionCycleMonths}개월 주기로 다음 예정일이 자동 계산됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>점검 실시일</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>날짜 선택</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => {
            if (date) {
              onInspect(asset.id, date);
              setOpen(false);
            }
          }}>업데이트 확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAssetDialog({ asset, onEdit, categories }: { asset: Asset, onEdit: (id: string, data: Partial<Asset>) => void, categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: asset.name,
      serialNumber: asset.serialNumber,
      categoryId: asset.categoryId,
      teamId: asset.teamId,
      inspectionCycleMonths: asset.inspectionCycleMonths
    }
  });

  const onSubmit = (data: any) => {
    onEdit(asset.id, {
      ...data,
      inspectionCycleMonths: parseInt(data.inspectionCycleMonths)
    });
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
          <DialogTitle>장비 정보 수정</DialogTitle>
          <DialogDescription>
            장비 정보를 수정합니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">장비명</Label>
            <Input id="edit-name" {...register("name", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-serial">시리얼 넘버</Label>
            <Input id="edit-serial" {...register("serialNumber", { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label htmlFor="edit-category">카테고리</Label>
              <Select defaultValue={asset.categoryId} onValueChange={(v) => register("categoryId").onChange({ target: { value: v, name: "categoryId" } })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team">관리 팀</Label>
              <Select defaultValue={asset.teamId} onValueChange={(v) => register("teamId").onChange({ target: { value: v, name: "teamId" } })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-cycle">점검 주기 (개월)</Label>
            <Input id="edit-cycle" type="number" {...register("inspectionCycleMonths", { required: true })} />
          </div>
          <DialogFooter>
            <Button type="submit">저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAssetDialog({ asset, onDelete }: { asset: Asset, onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          삭제
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>장비 삭제</DialogTitle>
          <DialogDescription>
            정말로 <strong>{asset.name}</strong> 장비를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
          <Button variant="destructive" onClick={() => {
            onDelete(asset.id);
            setOpen(false);
          }}>삭제</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAssetDialog({ onAdd, categories }: { onAdd: () => void, categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  const { toast } = useToast();

  const onSubmit = (data: any) => {
    store.addAsset({
      name: data.name,
      serialNumber: data.serialNumber,
      categoryId: data.categoryId,
      teamId: store.currentUser.teamId, // Assign to current user's team
      inspectionCycleMonths: parseInt(data.inspectionCycleMonths),
      lastInspectedDate: data.lastInspectedDate,
    });
    onAdd();
    setOpen(false);
    reset();
    toast({ title: "장비 등록 완료", description: "새로운 장비가 성공적으로 등록되었습니다." });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" /> 장비 등록</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>신규 장비 등록</DialogTitle>
          <DialogDescription>
            {getTeamName(store.currentUser.teamId)} 팀의 새로운 장비를 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">장비명</Label>
              <Input id="name" {...register("name", { required: true })} placeholder="예: 정밀 저울" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial">시리얼 넘버</Label>
              <Input id="serial" {...register("serialNumber", { required: true })} placeholder="SN-12345" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label htmlFor="category">카테고리</Label>
              <Select onValueChange={(v) => register("categoryId").onChange({ target: { value: v, name: "categoryId" } })}>
                <SelectTrigger>
                  <SelectValue placeholder="종류 선택" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle">점검 주기 (개월)</Label>
              <Input id="cycle" type="number" {...register("inspectionCycleMonths", { required: true })} placeholder="6" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastDate">최근 점검일</Label>
            <Input id="lastDate" type="date" {...register("lastInspectedDate", { required: true })} />
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit">등록 완료</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
