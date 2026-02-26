import { useState, useEffect } from "react";
import { Asset, AssetStatus, Team, User, Category } from "@/lib/types";
import { useLocation, useSearch } from "wouter";
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
import { format, addDays, parseISO, isWeekend, nextMonday } from "date-fns";
import { ko } from "date-fns/locale";
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
  Tags,
  Eye,
  Download
} from "lucide-react";

const CYCLE_OPTIONS = [
  { value: "7", label: "7일 (1주)" },
  { value: "14", label: "14일 (2주)" },
  { value: "30", label: "30일 (1개월)" },
  { value: "90", label: "90일 (3개월)" },
  { value: "180", label: "180일 (6개월)" },
  { value: "365", label: "365일 (1년)" },
  { value: "730", label: "730일 (2년)" },
  { value: "custom", label: "직접 지정" },
];

function calculatePreviewDate(lastDate: string, cycleDays: number): { raw: Date; adjusted: Date; isAdjusted: boolean } | null {
  if (!lastDate || !cycleDays || cycleDays <= 0) return null;
  try {
    const base = parseISO(lastDate);
    const raw = addDays(base, cycleDays - 1);
    const adjusted = isWeekend(raw) ? nextMonday(raw) : raw;
    return { raw, adjusted, isAdjusted: isWeekend(raw) };
  } catch {
    return null;
  }
}

function InspectionCyclePreview({ lastDate, cycleDays }: { lastDate: string; cycleDays: number }) {
  const preview = calculatePreviewDate(lastDate, cycleDays);
  if (!preview) return null;

  const rawStr = format(preview.raw, "yyyy-MM-dd (EEE)", { locale: ko });
  const adjustedStr = format(preview.adjusted, "yyyy-MM-dd (EEE)", { locale: ko });

  return (
    <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
      <p className="text-sm font-bold text-blue-700">
        {preview.isAdjusted ? (
          <>예상 차기 점검일: <span className="line-through text-blue-400">{rawStr}</span> → 주말 제외 조정됨: {adjustedStr}</>
        ) : (
          <>예상 차기 점검일: {adjustedStr}</>
        )}
      </p>
      <p className="text-xs text-blue-500 mt-1">예상 차기 점검일 7일 전부터 매일 오전 9시에 알림이 발송됩니다</p>
    </div>
  );
}

function CycleSelector({ value, onChange, customValue, onCustomChange }: {
  value: string;
  onChange: (v: string) => void;
  customValue: string;
  onCustomChange: (v: string) => void;
}) {
  const isCustom = value === "custom";

  return (
    <div className="space-y-2">
      <Label>점검 주기</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="주기 선택" />
        </SelectTrigger>
        <SelectContent>
          {CYCLE_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isCustom && (
        <div className="space-y-1">
          <Input
            type="number"
            min={1}
            placeholder="일수 입력"
            value={customValue}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || parseInt(val) > 0) {
                onCustomChange(val);
              }
            }}
          />
          {customValue !== "" && parseInt(customValue) <= 0 && (
            <p className="text-xs text-red-500">1 이상의 숫자를 입력해주세요.</p>
          )}
        </div>
      )}
    </div>
  );
}
import ExcelImportDialog from "@/components/ExcelImportDialog";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Assets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const searchString = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const status = params.get('status');
    const category = params.get('category');
    
    if (status && ['ok', 'upcoming', 'overdue'].includes(status)) {
      setStatusFilter(status as AssetStatus);
    }
    if (category) {
      setCategoryFilter(category);
    }
  }, [searchString]);

  const { data: allAssets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    queryFn: () => api.assets.getAll(),
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: () => api.teams.getAll(),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => api.users.getAll(),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => api.categories.getAll(),
  });

  const assets = auth.filterAssetsForUser(allAssets, currentUser);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.assets.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "장비 삭제 완료",
        description: "장비가 목록에서 제거되었습니다.",
        variant: "destructive"
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Asset> }) => api.assets.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "장비 수정 완료",
        description: "장비 정보가 업데이트되었습니다."
      });
    },
  });

  const inspectMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => 
      api.assets.inspect(id, { date, inspectorId: currentUser?.id || "" }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      toast({
        title: "점검 기록 완료",
        description: `다음 점검 예정일이 계산되었습니다: ${updated.nextDueDate}`,
      });
    },
  });

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || asset.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || asset.categoryId === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name || id;
  const getUserName = (id: string) => users.find(u => u.id === id)?.username || id;

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
    inspectMutation.mutate({ id, date: format(date, 'yyyy-MM-dd') });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleEdit = (id: string, data: Partial<Asset>) => {
    updateMutation.mutate({ id, data });
  };

  const getRoleDescription = () => {
    if (!currentUser) return "";
    switch (currentUser.role) {
      case 'admin': return "모든 장비를 조회하고 관리할 수 있습니다.";
      case 'manager': return "내가 관리하는 장비만 표시됩니다.";
      case 'staff': return "내가 담당하는 장비만 표시됩니다.";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">장비 관리</h2>
          <p className="text-muted-foreground">{getRoleDescription()}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {auth.canAddAsset(currentUser) && (
            <>
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href="/api/assets/export" download>
                  <Download className="h-4 w-4" />
                  다운로드
                </a>
              </Button>
              <ExcelImportDialog
                title="장비 엑셀 업로드"
                description="엑셀 파일에서 장비 목록을 일괄 등록합니다. 팀, 관리자명은 기존 등록된 이름과 동일해야 합니다."
                templateUrl="/api/assets/template"
                importUrl="/api/assets/import"
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/assets"] })}
              />
            </>
          )}
          {auth.canAddAsset(currentUser) && (
            <AddAssetDialog 
              teams={teams} 
              users={users}
              categories={categories}
              currentUser={currentUser}
            />
          )}
        </div>
      </div>

      {assets.length === 0 && currentUser?.role !== 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {currentUser?.role === 'manager' ? '관리 중인 장비가 없습니다' : '담당 장비가 없습니다'}
            </CardTitle>
            <CardDescription>
              {currentUser?.role === 'manager' 
                ? '아직 관리자로 지정된 장비가 없습니다. 마스터에게 장비 배정을 요청하세요.'
                : '아직 담당자로 지정된 대상이 없습니다. 대상 관리자에게 배정을 요청하세요.'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {(assets.length > 0 || currentUser?.role === 'admin') && (
        <>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="장비 검색..." 
                className="pl-8" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-full sm:w-[180px]">
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

          <div className="flex flex-wrap gap-2">
            <Button
              variant={categoryFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter("all")}
            >
              <Tags className="w-4 h-4 mr-1" />
              전체 ({assets.length})
            </Button>
            {categories.map((cat) => {
              const count = assets.filter(a => a.categoryId === cat.id).length;
              if (count === 0) return null;
              return (
                <Button
                  key={cat.id}
                  variant={categoryFilter === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryFilter(cat.id)}
                >
                  {cat.name} ({count})
                </Button>
              );
            })}
          </div>

          <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>대상</TableHead>
                  <TableHead>구분</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>담당팀</TableHead>
                  <TableHead>최근 점검일</TableHead>
                  <TableHead>다음 예정일</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 장비가 없습니다.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div className="font-medium">{asset.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{asset.serialNumber}</div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{categories.find(c => c.id === asset.categoryId)?.name || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getUserName(asset.staffId)}</span>
                      </TableCell>
                      <TableCell>{getTeamName(asset.teamId)}</TableCell>
                      <TableCell>{format(new Date(asset.lastInspectedDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="font-medium">
                        {format(new Date(asset.nextDueDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>{getStatusBadge(asset.status as AssetStatus)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {auth.canInspectAsset(currentUser, asset) && (
                            <InspectDialog asset={asset} onInspect={handleInspect} />
                          )}
                          {auth.canEditAsset(currentUser, asset) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>작업</DropdownMenuLabel>
                                <EditAssetDialog 
                                  asset={asset} 
                                  onEdit={handleEdit} 
                                  teams={teams}
                                  users={users}
                                  categories={categories}
                                />
                                {auth.canDeleteAsset(currentUser) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DeleteAssetDialog asset={asset} onDelete={handleDelete} />
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
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
            <strong>{asset.name}</strong>의 점검일을 업데이트합니다. {asset.inspectionCycleDays}일 주기로 다음 예정일이 자동 계산됩니다.
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
                  {date ? format(date, "yyyy년 MM월 dd일 (EEE)", { locale: ko }) : <span>날짜 선택</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={ko}
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

function EditAssetDialog({ asset, onEdit, teams, users, categories }: { asset: Asset, onEdit: (id: string, data: Partial<Asset>) => void, teams: Team[], users: User[], categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string>(asset.categoryId || "");

  const currentDays = asset.inspectionCycleDays;
  const presetMatch = CYCLE_OPTIONS.find(o => o.value !== "custom" && parseInt(o.value) === currentDays);
  const [cycleSelectValue, setCycleSelectValue] = useState<string>(presetMatch ? presetMatch.value : "custom");
  const [customCycleDays, setCustomCycleDays] = useState<string>(presetMatch ? "" : String(currentDays));

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      name: asset.name,
      serialNumber: asset.serialNumber,
      categoryId: asset.categoryId || "",
      teamId: asset.teamId,
      managerId: asset.managerId,
      staffId: asset.staffId,
      lastInspectedDate: asset.lastInspectedDate,
    }
  });

  const watchedTeamId = watch("teamId");
  const staffMembers = users.filter(u => u.role === 'staff' && u.teamId === watchedTeamId);
  const editCategory = categories.find(c => c.id === editCategoryId);
  const editCategoryManagers = (editCategory?.managerIds || []).map(mid => users.find(u => u.id === mid)).filter(Boolean);

  const effectiveCycleDays = cycleSelectValue === "custom" ? parseInt(customCycleDays) || 0 : parseInt(cycleSelectValue) || 0;
  const watchedLastDate = watch("lastInspectedDate");

  const onSubmit = (data: any) => {
    if (effectiveCycleDays <= 0) return;
    onEdit(asset.id, {
      ...data,
      inspectionCycleDays: effectiveCycleDays,
    });
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      const pm = CYCLE_OPTIONS.find(o => o.value !== "custom" && parseInt(o.value) === asset.inspectionCycleDays);
      setCycleSelectValue(pm ? pm.value : "custom");
      setCustomCycleDays(pm ? "" : String(asset.inspectionCycleDays));
      setEditCategoryId(asset.categoryId || "");
      setValue("lastInspectedDate", asset.lastInspectedDate);
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>장비 정보 수정</DialogTitle>
          <DialogDescription>
            장비 정보를 수정합니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">대상</Label>
              <Input id="edit-name" {...register("name", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-serial">시리얼 넘버</Label>
              <Input id="edit-serial" {...register("serialNumber", { required: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>구분</Label>
              <Select value={watch("categoryId")} onValueChange={(v) => {
                setValue("categoryId", v);
                setEditCategoryId(v);
                const cat = categories.find(c => c.id === v);
                if (cat?.managerIds && cat.managerIds.length > 0) {
                  setValue("managerId", cat.managerIds[0]);
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editCategoryManagers.length > 0 && (
              <div className="space-y-2">
                <Label>대상 관리자</Label>
                <Select value={watch("managerId")} onValueChange={(v) => setValue("managerId", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {editCategoryManagers.map(u => u && <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>담당팀</Label>
              <Select value={watch("teamId")} onValueChange={(v) => {
                setValue("teamId", v);
                const teamStaff = users.filter(u => u.role === 'staff' && u.teamId === v);
                if (teamStaff.length > 0) {
                  setValue("staffId", teamStaff[0].id);
                } else {
                  setValue("staffId", "");
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>담당자</Label>
              <Select value={watch("staffId")} onValueChange={(v) => setValue("staffId", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.length > 0 ? staffMembers.map(u => <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">해당 팀에 소속된 담당자가 없습니다</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CycleSelector
              value={cycleSelectValue}
              onChange={setCycleSelectValue}
              customValue={customCycleDays}
              onCustomChange={setCustomCycleDays}
            />
            <div className="space-y-2">
              <Label>최근 점검일</Label>
              <Input
                type="date"
                {...register("lastInspectedDate")}
                onChange={(e) => setValue("lastInspectedDate", e.target.value)}
              />
            </div>
          </div>

          {watchedLastDate && effectiveCycleDays > 0 && (
            <InspectionCyclePreview lastDate={watchedLastDate} cycleDays={effectiveCycleDays} />
          )}

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

function AddAssetDialog({ teams, users, categories, currentUser }: { teams: Team[], users: User[], categories: Category[], currentUser: User | null }) {
  const [open, setOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [cycleSelectValue, setCycleSelectValue] = useState<string>("");
  const [customCycleDays, setCustomCycleDays] = useState<string>("");
  const [lastDate, setLastDate] = useState<string>("");
  const { register, handleSubmit, reset, setValue } = useForm();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const managers = users.filter(u => u.role === 'manager');
  const staffMembers = selectedTeamId ? users.filter(u => u.role === 'staff' && u.teamId === selectedTeamId) : [];
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const categoryManagers = (selectedCategory?.managerIds || []).map(mid => users.find(u => u.id === mid)).filter(Boolean);

  const effectiveCycleDays = cycleSelectValue === "custom" ? parseInt(customCycleDays) || 0 : parseInt(cycleSelectValue) || 0;

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      return api.assets.create({
        name: data.name,
        serialNumber: data.serialNumber,
        categoryId: data.categoryId,
        teamId: data.teamId,
        managerId: data.managerId || (selectedCategory?.managerIds && selectedCategory.managerIds.length > 0 ? selectedCategory.managerIds[0] : null) || currentUser?.id || managers[0]?.id,
        usageTeamId: data.teamId,
        staffId: data.staffId || staffMembers[0]?.id,
        inspectionCycleDays: effectiveCycleDays,
        lastInspectedDate: data.lastInspectedDate,
        inspectorId: currentUser?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      setOpen(false);
      reset();
      setCycleSelectValue("");
      setCustomCycleDays("");
      setLastDate("");
      setSelectedTeamId("");
      toast({ title: "장비 등록 완료", description: "새로운 장비가 성공적으로 등록되었습니다." });
    },
  });

  const onSubmit = (data: any) => {
    if (effectiveCycleDays <= 0) {
      toast({ title: "입력 오류", description: "점검 주기를 선택하거나 1 이상의 숫자를 입력해주세요.", variant: "destructive" });
      return;
    }
    createMutation.mutate(data);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      reset();
      setSelectedCategoryId("");
      setSelectedTeamId("");
      setCycleSelectValue("");
      setCustomCycleDays("");
      setLastDate("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" /> 장비 등록</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>신규 장비 등록</DialogTitle>
          <DialogDescription>
            새로운 장비를 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">대상</Label>
              <Input id="name" {...register("name", { required: true })} placeholder="예: 정밀 저울" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial">시리얼 넘버</Label>
              <Input id="serial" {...register("serialNumber", { required: true })} placeholder="SN-12345" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>구분</Label>
              <Select onValueChange={(v) => {
                setValue("categoryId", v);
                setSelectedCategoryId(v);
                const cat = categories.find(c => c.id === v);
                if (cat?.managerIds && cat.managerIds.length > 0) {
                  setValue("managerId", cat.managerIds[0]);
                }
                if (cat?.defaultCycleDays) {
                  const preset = CYCLE_OPTIONS.find(o => o.value !== "custom" && parseInt(o.value) === cat.defaultCycleDays);
                  if (preset) {
                    setCycleSelectValue(preset.value);
                    setCustomCycleDays("");
                  } else {
                    setCycleSelectValue("custom");
                    setCustomCycleDays(String(cat.defaultCycleDays));
                  }
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="구분 선택" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {categoryManagers.length > 1 && (
              <div className="space-y-2">
                <Label>대상 관리자</Label>
                <Select defaultValue={categoryManagers[0]?.id} onValueChange={(v) => setValue("managerId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="관리자 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryManagers.map(u => u && <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>담당팀</Label>
              <Select onValueChange={(v) => {
                setValue("teamId", v);
                setSelectedTeamId(v);
                setValue("staffId", "");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="담당팀 선택" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>담당자</Label>
              <Select onValueChange={(v) => setValue("staffId", v)} disabled={!selectedTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedTeamId ? "담당자 선택" : "담당팀을 먼저 선택하세요"} />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.length > 0 ? staffMembers.map(u => <SelectItem key={u.id} value={u.id}>{u.username}</SelectItem>) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">해당 팀에 소속된 담당자가 없습니다</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CycleSelector
              value={cycleSelectValue}
              onChange={setCycleSelectValue}
              customValue={customCycleDays}
              onCustomChange={setCustomCycleDays}
            />
            <div className="space-y-2">
              <Label htmlFor="lastDate">최근 점검일</Label>
              <Input
                id="lastDate"
                type="date"
                {...register("lastInspectedDate", { required: true })}
                onChange={(e) => {
                  setValue("lastInspectedDate", e.target.value);
                  setLastDate(e.target.value);
                }}
              />
            </div>
          </div>

          {lastDate && effectiveCycleDays > 0 && (
            <InspectionCyclePreview lastDate={lastDate} cycleDays={effectiveCycleDays} />
          )}

          <DialogFooter className="mt-4">
            <Button type="submit">등록 완료</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
