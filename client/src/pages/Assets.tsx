import { useState, useEffect, useMemo } from "react";
import {
  Asset,
  AssetStatus,
  Team,
  User,
  Category,
  AssetHistory,
} from "@/lib/types";
import { useLocation, useSearch } from "wouter";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays, parseISO, isWeekend, nextMonday } from "date-fns";
import { ko } from "date-fns/locale";
import {
  CalendarIcon,
  CalendarDays,
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
  Download,
  PauseCircle,
  PlayCircle,
  History,
  CheckSquare,
  Ban,
  List,
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

function calculatePreviewDate(
  lastDate: string,
  cycleDays: number,
): { raw: Date; adjusted: Date; isAdjusted: boolean } | null {
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

function InspectionCyclePreview({
  lastDate,
  cycleDays,
}: {
  lastDate: string;
  cycleDays: number;
}) {
  const preview = calculatePreviewDate(lastDate, cycleDays);
  if (!preview) return null;

  const rawStr = format(preview.raw, "yyyy-MM-dd (EEE)", { locale: ko });
  const adjustedStr = format(preview.adjusted, "yyyy-MM-dd (EEE)", {
    locale: ko,
  });

  return (
    <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
      <p className="text-sm font-bold text-blue-700">
        {preview.isAdjusted ? (
          <>
            예상 차기 점검일:{" "}
            <span className="line-through text-blue-400">{rawStr}</span> → 주말
            제외 조정됨: {adjustedStr}
          </>
        ) : (
          <>예상 차기 점검일: {adjustedStr}</>
        )}
      </p>
      <p className="text-xs text-blue-500 mt-1">
        예상 차기 점검일 7일 전부터 매일 오전 9시에 알림이 발송됩니다
      </p>
    </div>
  );
}

function CycleSelector({
  value,
  onChange,
  customValue,
  onCustomChange,
}: {
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
          {CYCLE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
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
            <p className="text-xs text-red-500">
              1 이상의 숫자를 입력해주세요.
            </p>
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CalendarView from "@/components/CalendarView";
import { addMonths, startOfMonth } from "date-fns";

const CHANGE_TYPE_LABELS: Record<string, string> = {
  created: "신규 등록",
  updated: "정보 수정",
  inspected: "점검 수행",
  suspended: "중단",
  resumed: "재개",
  staff_changed: "담당자 변경",
  manager_changed: "관리자 변경",
};

export default function Assets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchInspectOpen, setBatchInspectOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyAssetId, setHistoryAssetId] = useState<string | null>(null);
  const [globalHistoryOpen, setGlobalHistoryOpen] = useState(false);
  const [assetPopupDate, setAssetPopupDate] = useState<Date | null>(null); // 2026-04-08 장비캘린더 날짜팝업
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser } = useUser();
  const searchString = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const status = params.get("status");
    const category = params.get("category");

    if (status && ["ok", "upcoming", "overdue", "suspended"].includes(status)) {
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

  const myAssets = useMemo(() => {
    if (!currentUser) return [];
    return assets.filter(
      (a) =>
        a.managerId === currentUser.id ||
        a.staffId === currentUser.id ||
        a.teamId === currentUser.teamId ||
        a.usageTeamId === currentUser.teamId,
    );
  }, [assets, currentUser]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.assets.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "장비 삭제 완료",
        description: "장비가 목록에서 제거되었습니다.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Asset> }) =>
      api.assets.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "장비 수정 완료",
        description: "장비 정보가 업데이트되었습니다.",
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

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.assets.suspend(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "중단 처리 완료",
        description: "장비가 중단 상태로 변경되었습니다.",
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.assets.resume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      toast({
        title: "재개 처리 완료",
        description: "장비가 정상 상태로 복귀되었습니다.",
      });
    },
  });

  const batchInspectMutation = useMutation({
    mutationFn: ({ assetIds, date }: { assetIds: string[]; date: string }) =>
      api.assets.batchInspect(assetIds, date),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      setSelectedIds(new Set());
      setBatchInspectOpen(false);
      toast({
        title: "일괄 점검 완료",
        description: `${result.count}건의 장비가 점검 처리되었습니다.`,
      });
    },
  });

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || asset.status === statusFilter;
    const matchesCategory =
      categoryFilter === "all" || asset.categoryId === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getTeamName = (id: string) =>
    teams.find((t) => t.id === id)?.name || id;
  const getUserName = (id: string) =>
    users.find((u) => u.id === id)?.username || id;
  const getDeptName = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    return team?.department || "-";
  };

  const DEPT_ORDER = [
    "한국석유관리원",
    "기획처",
    "지원안전처",
    "검사처",
    "사업처",
    "수송유통관리센터",
    "감사실",
    "연구처",
    "시험처",
    "수도권남부본부",
    "수도권북부본부",
    "대전세종충남본부",
    "충북본부",
    "광주전남본부",
    "전북본부",
    "부산울산경남본부",
    "대구경북본부",
    "강원본부",
    "제주본부",
  ];

  const allDepts = Array.from(
    new Set(teams.map((t) => t.department).filter(Boolean)),
  ) as string[];

  const departments = [
    ...DEPT_ORDER.filter((d) => allDepts.includes(d)),
    ...allDepts.filter((d) => !DEPT_ORDER.includes(d)),
  ];

  const getStatusBadge = (
    status: AssetStatus,
    suspendedReason?: string | null,
  ) => {
    switch (status) {
      case "ok":
        return (
          <Badge
            className="bg-status-ok hover:bg-status-ok/90 text-white border-0"
            data-testid="badge-status-ok"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> 정상
          </Badge>
        );
      case "upcoming":
        return (
          <Badge
            className="bg-status-warning hover:bg-status-warning/90 text-white border-0"
            data-testid="badge-status-upcoming"
          >
            <Clock className="w-3 h-3 mr-1" /> 임박
          </Badge>
        );
      case "overdue":
        return (
          <Badge
            className="bg-status-error hover:bg-status-error/90 text-white border-0"
            data-testid="badge-status-overdue"
          >
            <AlertCircle className="w-3 h-3 mr-1" /> 지연
          </Badge>
        );
      case "suspended":
        return (
          <Badge
            className="bg-gray-500 hover:bg-gray-600 text-white border-0"
            data-testid="badge-status-suspended"
            title={suspendedReason || ""}
          >
            <Ban className="w-3 h-3 mr-1" /> 중단
          </Badge>
        );
    }
  };

  const handleInspect = (id: string, date: Date) => {
    inspectMutation.mutate({ id, date: format(date, "yyyy-MM-dd") });
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleEdit = (id: string, data: Partial<Asset>) => {
    updateMutation.mutate({ id, data });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableIds = filteredAssets
    .filter((a) => a.status !== "suspended")
    .map((a) => a.id);
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  };

  const getRoleDescription = () => {
    if (!currentUser) return "";
    switch (currentUser.role) {
      case "admin":
        return "모든 장비를 조회하고 관리할 수 있습니다.";
      case "manager":
        return "내가 관리하는 장비만 표시됩니다.";
      case "staff":
        return "내가 담당하는 장비만 표시됩니다.";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">장비 관리</h2>
          <p className="text-muted-foreground">{getRoleDescription()}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
          <div className="flex rounded-md border overflow-hidden">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none gap-1"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">목록</span>
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              className="rounded-none gap-1"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden sm:inline">점검 캘린더</span>
            </Button>
          </div>
          {auth.canAddAsset(currentUser) && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hidden sm:flex rounded-none h-8"
                asChild
              >
                <a href="/api/assets/export" download>
                  <Download className="h-4 w-4" />
                  다운로드
                </a>
              </Button>
              <div className="hidden sm:block">
                <ExcelImportDialog
                  title="장비 엑셀 업로드"
                  description="엑셀 파일에서 장비 목록을 일괄 등록합니다. 팀, 관리자명은 기존 등록된 이름과 동일해야 합니다."
                  templateUrl="/api/assets/template"
                  importUrl="/api/assets/import"
                  onSuccess={() =>
                    queryClient.invalidateQueries({ queryKey: ["/api/assets"] })
                  }
                />
              </div>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-none h-8"
            onClick={() => setGlobalHistoryOpen(true)}
            data-testid="button-view-history"
          >
            <History className="h-4 w-4" />
            이력 보기
          </Button>
          {auth.canAddAsset(currentUser) && (
            <AddAssetDialog
              teams={teams}
              users={users}
              categories={categories}
              currentUser={currentUser}
              departments={departments}
            />
          )}
        </div>
      </div>

      {viewMode === "calendar" ? (
        <CalendarView
          tasks={[]}
          allTasks={[]}
          assets={assets}
          filter="all"
          calendarMonth={calendarMonth}
          onPrevMonth={() => setCalendarMonth((prev) => addMonths(prev, -1))}
          onNextMonth={() => setCalendarMonth((prev) => addMonths(prev, 1))}
          onToday={() => setCalendarMonth(startOfMonth(new Date()))}
          onDateClick={(date) => setAssetPopupDate(date)} // 2026-04-08 장비캘린더 날짜팝업
          onTaskClick={() => {}}
        />
      ) : (
        <>
          {assets.length === 0 && currentUser?.role !== "admin" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  {currentUser?.role === "manager"
                    ? "관리 중인 장비가 없습니다"
                    : "담당 장비가 없습니다"}
                </CardTitle>
                <CardDescription>
                  {currentUser?.role === "manager"
                    ? "아직 관리자로 지정된 장비가 없습니다. 마스터에게 장비 배정을 요청하세요."
                    : "아직 담당자로 지정된 대상이 없습니다. 구분 관리자에게 배정을 요청하세요."}
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {(assets.length > 0 || currentUser?.role === "admin") && (
            <>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1 sm:max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="장비 검색..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="input-search"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(v: any) => setStatusFilter(v)}
                >
                  <SelectTrigger
                    className="w-full sm:w-[180px]"
                    data-testid="select-status-filter"
                  >
                    <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="상태 필터" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    <SelectItem value="ok">정상</SelectItem>
                    <SelectItem value="upcoming">임박</SelectItem>
                    <SelectItem value="overdue">지연</SelectItem>
                    <SelectItem value="suspended">중단</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  variant={categoryFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoryFilter("all")}
                >
                  <Tags className="w-4 h-4 mr-1" />
                  전체 ({assets.length})
                </Button>
                {categories.map((cat) => {
                  const count = assets.filter(
                    (a) => a.categoryId === cat.id,
                  ).length;
                  if (count === 0) return null;
                  return (
                    <Button
                      key={cat.id}
                      variant={
                        categoryFilter === cat.id ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setCategoryFilter(cat.id)}
                    >
                      {cat.name} ({count})
                    </Button>
                  );
                })}

                {selectedIds.size > 0 && (
                  <Button
                    size="sm"
                    className="ml-auto gap-2 bg-blue-600 hover:bg-blue-700"
                    onClick={() => setBatchInspectOpen(true)}
                    data-testid="button-batch-inspect"
                  >
                    <CheckSquare className="w-4 h-4" />
                    일괄 점검 ({selectedIds.size}건)
                  </Button>
                )}
              </div>

              <div className="rounded-md border bg-card shadow-sm overflow-x-auto">
                <Table className="min-w-[1000px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>대상</TableHead>
                      <TableHead>구분</TableHead>
                      <TableHead>담당자</TableHead>
                      <TableHead>부서</TableHead>
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
                        <TableCell colSpan={10} className="h-24 text-center">
                          {searchTerm ||
                          statusFilter !== "all" ||
                          categoryFilter !== "all"
                            ? "검색 결과가 없습니다."
                            : "등록된 장비가 없습니다."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAssets.map((asset) => (
                        <TableRow
                          key={asset.id}
                          className={
                            asset.status === "suspended" ? "opacity-60" : ""
                          }
                          data-testid={`row-asset-${asset.id}`}
                        >
                          <TableCell>
                            {asset.status !== "suspended" && (
                              <Checkbox
                                checked={selectedIds.has(asset.id)}
                                onCheckedChange={() => toggleSelect(asset.id)}
                                data-testid={`checkbox-asset-${asset.id}`}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <button
                              className="text-left hover:underline cursor-pointer"
                              onClick={() => {
                                setHistoryAssetId(asset.id);
                                setHistoryDialogOpen(true);
                              }}
                              data-testid={`button-asset-history-${asset.id}`}
                            >
                              <div className="font-medium">{asset.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {asset.serialNumber}
                              </div>
                            </button>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {categories.find((c) => c.id === asset.categoryId)
                                ?.name || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {getUserName(asset.staffId)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {getDeptName(asset.teamId)}
                          </TableCell>
                          <TableCell>{getTeamName(asset.teamId)}</TableCell>
                          <TableCell>
                            {format(
                              new Date(asset.lastInspectedDate),
                              "MMM d, yyyy",
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {format(new Date(asset.nextDueDate), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(
                              asset.status as AssetStatus,
                              asset.suspendedReason,
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {asset.status === "suspended" ? (
                                auth.canEditAsset(currentUser, asset) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1 text-green-600 border-green-300 hover:bg-green-50"
                                    onClick={() =>
                                      resumeMutation.mutate(asset.id)
                                    }
                                    data-testid={`button-resume-${asset.id}`}
                                  >
                                    <PlayCircle className="w-3 h-3" />
                                    재개
                                  </Button>
                                )
                              ) : (
                                <>
                                  {auth.canInspectAsset(currentUser, asset) && (
                                    <InspectDialog
                                      asset={asset}
                                      onInspect={handleInspect}
                                    />
                                  )}
                                  {auth.canEditAsset(currentUser, asset) && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          className="h-8 w-8 p-0"
                                        >
                                          <span className="sr-only">
                                            Open menu
                                          </span>
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>
                                          작업
                                        </DropdownMenuLabel>
                                        <EditAssetDialog
                                          asset={asset}
                                          onEdit={handleEdit}
                                          teams={teams}
                                          users={users}
                                          categories={categories}
                                          departments={departments}
                                        />
                                        <SuspendAssetDialog
                                          asset={asset}
                                          onSuspend={(id, reason) =>
                                            suspendMutation.mutate({
                                              id,
                                              reason,
                                            })
                                          }
                                        />
                                        {auth.canDeleteAsset(
                                          currentUser,
                                          asset,
                                        ) && (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DeleteAssetDialog
                                              asset={asset}
                                              onDelete={handleDelete}
                                            />
                                          </>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </>
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
        </>
      )}

      <BatchInspectDialog
        open={batchInspectOpen}
        onOpenChange={setBatchInspectOpen}
        selectedCount={selectedIds.size}
        onConfirm={(date) => {
          batchInspectMutation.mutate({
            assetIds: Array.from(selectedIds),
            date: format(date, "yyyy-MM-dd"),
          });
        }}
        isPending={batchInspectMutation.isPending}
      />

      <AssetHistoryDialog
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        assetId={historyAssetId}
        assets={allAssets}
        users={users}
        categories={categories}
        teams={teams}
      />

      {/* 2026-04-08 장비캘린더 날짜클릭 팝업 */}
      <Dialog
        open={!!assetPopupDate}
        onOpenChange={(open) => !open && setAssetPopupDate(null)}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {assetPopupDate &&
                format(assetPopupDate, "yyyy년 M월 d일 (EEE)", {
                  locale: ko,
                })}{" "}
              장비 점검
            </DialogTitle>
            <DialogDescription>
              해당 날짜에 점검 예정인 장비 목록입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[400px]">
            {(() => {
              const dateKey = assetPopupDate
                ? format(assetPopupDate, "yyyy-MM-dd")
                : "";
              const dueAssets = assets.filter(
                (a) => a.status !== "suspended" && a.nextDueDate === dateKey,
              );
              if (dueAssets.length === 0) {
                return (
                  <p className="text-center py-8 text-muted-foreground">
                    해당 날짜에 점검 예정인 장비가 없습니다.
                  </p>
                );
              }
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>대상</TableHead>
                      <TableHead>구분</TableHead>
                      <TableHead>담당자</TableHead>
                      <TableHead>부서</TableHead>
                      <TableHead>담당팀</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">
                          {asset.name}
                        </TableCell>
                        <TableCell>
                          {categories.find((c) => c.id === asset.categoryId)
                            ?.name || "-"}
                        </TableCell>
                        <TableCell>{getUserName(asset.staffId)}</TableCell>
                        <TableCell>{getDeptName(asset.teamId)}</TableCell>
                        <TableCell>{getTeamName(asset.teamId)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <GlobalHistoryDialog
        open={globalHistoryOpen}
        onOpenChange={setGlobalHistoryOpen}
        categoryFilter={categoryFilter}
        assets={allAssets}
        users={users}
        categories={categories}
        teams={teams}
      />
    </div>
  );
}

function BatchInspectDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedCount: number;
  onConfirm: (date: Date) => void;
  isPending: boolean;
}) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>일괄 점검</DialogTitle>
          <DialogDescription>
            선택한 <strong>{selectedCount}건</strong>의 장비를 동일한 날짜로
            점검 처리합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>점검 실시일</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? (
                    format(date, "yyyy년 MM월 dd일 (EEE)", { locale: ko })
                  ) : (
                    <span>날짜 선택</span>
                  )}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            onClick={() => date && onConfirm(date)}
            disabled={!date || isPending}
            data-testid="button-confirm-batch-inspect"
          >
            {isPending ? "처리 중..." : `${selectedCount}건 일괄 점검`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuspendAssetDialog({
  asset,
  onSuspend,
}: {
  asset: Asset;
  onSuspend: (id: string, reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const presetReasons = ["파손", "수리중", "폐기 예정", "이관 중"];
  const effectiveReason = reason === "직접입력" ? customReason : reason;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setReason("");
          setCustomReason("");
        }
      }}
    >
      <DialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          data-testid={`button-suspend-${asset.id}`}
        >
          <PauseCircle className="mr-2 h-4 w-4" />
          중단
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>장비 중단</DialogTitle>
          <DialogDescription>
            <strong>{asset.name}</strong>을(를) 중단 상태로 변경합니다. 중단된
            장비는 알림에서 제외됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>중단 사유</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger data-testid="select-suspend-reason">
                <SelectValue placeholder="사유 선택" />
              </SelectTrigger>
              <SelectContent>
                {presetReasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
                <SelectItem value="직접입력">직접 입력</SelectItem>
              </SelectContent>
            </Select>
            {reason === "직접입력" && (
              <Textarea
                placeholder="중단 사유를 입력해주세요"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                data-testid="input-suspend-reason-custom"
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={!effectiveReason.trim()}
            onClick={() => {
              onSuspend(asset.id, effectiveReason);
              setOpen(false);
              setReason("");
              setCustomReason("");
            }}
            data-testid="button-confirm-suspend"
          >
            중단 처리
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssetHistoryDialog({
  open,
  onOpenChange,
  assetId,
  assets,
  users,
  categories,
  teams,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assetId: string | null;
  assets: Asset[];
  users: User[];
  categories: Category[];
  teams: Team[];
}) {
  const { data: history = [], isLoading } = useQuery<AssetHistory[]>({
    queryKey: ["/api/assets", assetId, "history"],
    queryFn: () =>
      assetId ? api.history.getByAsset(assetId) : Promise.resolve([]),
    enabled: !!assetId && open,
  });

  const asset = assets.find((a) => a.id === assetId);
  const category = asset
    ? categories.find((c) => c.id === asset.categoryId)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            장비 이력 - {asset?.name || ""}
          </DialogTitle>
          <DialogDescription>
            {category?.name || ""} / {asset?.serialNumber || ""}
            {asset?.status === "suspended" && asset.suspendedReason && (
              <span className="ml-2 text-red-500">
                (중단: {asset.suspendedReason})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">
              이력을 불러오는 중...
            </p>
          ) : history.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              이력이 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>일자</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>수행자</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>팀</TableHead>
                  <TableHead>추가정보</TableHead>
                  <TableHead>추가정보2</TableHead>
                  <TableHead>내용</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => {
                  const performer = h.userId
                    ? users.find((u) => u.id === h.userId)
                    : null;
                  const performerTeam = performer
                    ? teams.find((t) => t.id === performer.teamId)
                    : null;
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {h.date
                          ? format(new Date(h.date), "yyyy-MM-dd HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CHANGE_TYPE_LABELS[h.changeType] || h.changeType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {performer?.username || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {performerTeam?.department || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {performerTeam?.name || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {asset?.serialNumber || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {asset?.notes || "-"}
                      </TableCell>
                      <TableCell
                        className="text-sm max-w-[200px] truncate"
                        title={h.notes || ""}
                      >
                        {h.notes ||
                          (h.fieldName
                            ? `${h.fieldName}: ${h.oldValue || "-"} → ${h.newValue || "-"}`
                            : "-")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          {assetId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              asChild
              data-testid="button-export-asset-history"
            >
              <a href={`/api/history/export?assetId=${assetId}`} download>
                <Download className="h-4 w-4" />
                엑셀 다운로드
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GlobalHistoryDialog({
  open,
  onOpenChange,
  categoryFilter,
  assets,
  users,
  categories,
  teams,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoryFilter: string;
  assets: Asset[];
  users: User[];
  categories: Category[];
  teams: Team[];
}) {
  const [localCategoryFilter, setLocalCategoryFilter] = useState<string>("all");

  useEffect(() => {
    if (open) {
      setLocalCategoryFilter(categoryFilter);
    }
  }, [open, categoryFilter]);

  const effectiveCategoryId =
    localCategoryFilter === "all" ? undefined : localCategoryFilter;

  const { data: history = [], isLoading } = useQuery<AssetHistory[]>({
    queryKey: ["/api/history", effectiveCategoryId],
    queryFn: () => api.history.getAll(effectiveCategoryId),
    enabled: open,
  });

  const exportUrl = effectiveCategoryId
    ? `/api/history/export?categoryId=${effectiveCategoryId}`
    : `/api/history/export`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1100px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            전체 이력 조회
          </DialogTitle>
          <DialogDescription>
            구분별 또는 전체 장비의 변경 이력을 조회합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 py-2">
          <Select
            value={localCategoryFilter}
            onValueChange={setLocalCategoryFilter}
          >
            <SelectTrigger
              className="w-[200px]"
              data-testid="select-history-category"
            >
              <SelectValue placeholder="구분 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 구분</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 ml-auto"
            asChild
            data-testid="button-export-global-history"
          >
            <a href={exportUrl} download>
              <Download className="h-4 w-4" />
              엑셀 다운로드
            </a>
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">
              이력을 불러오는 중...
            </p>
          ) : history.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              이력이 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>일자</TableHead>
                  <TableHead>구분</TableHead>
                  <TableHead>명칭</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>수행자</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>팀</TableHead>
                  <TableHead>추가정보</TableHead>
                  <TableHead>추가정보2</TableHead>
                  <TableHead>내용</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => {
                  const asset = assets.find((a) => a.id === h.assetId);
                  const cat = asset
                    ? categories.find((c) => c.id === asset.categoryId)
                    : null;
                  const performer = h.userId
                    ? users.find((u) => u.id === h.userId)
                    : null;
                  const performerTeam = performer
                    ? teams.find((t) => t.id === performer.teamId)
                    : null;
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {h.date
                          ? format(new Date(h.date), "yyyy-MM-dd HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {cat?.name || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {asset?.name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CHANGE_TYPE_LABELS[h.changeType] || h.changeType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {performer?.username || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {performerTeam?.department || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {performerTeam?.name || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {asset?.serialNumber || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {asset?.notes || "-"}
                      </TableCell>
                      <TableCell
                        className="text-sm max-w-[200px] truncate"
                        title={h.notes || ""}
                      >
                        {h.notes ||
                          (h.fieldName
                            ? `${h.fieldName}: ${h.oldValue || "-"} → ${h.newValue || "-"}`
                            : "-")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InspectDialog({
  asset,
  onInspect,
}: {
  asset: Asset;
  onInspect: (id: string, date: Date) => void;
}) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          data-testid={`button-inspect-${asset.id}`}
        >
          점검
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>점검 기록</DialogTitle>
          <DialogDescription>
            <strong>{asset.name}</strong>의 점검일을 업데이트합니다.{" "}
            {asset.inspectionCycleDays}일 주기로 다음 예정일이 자동 계산됩니다.
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
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? (
                    format(date, "yyyy년 MM월 dd일 (EEE)", { locale: ko })
                  ) : (
                    <span>날짜 선택</span>
                  )}
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
          <Button
            onClick={() => {
              if (date) {
                onInspect(asset.id, date);
                setOpen(false);
              }
            }}
            data-testid="button-confirm-inspect"
          >
            업데이트 확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditAssetDialog({
  asset,
  onEdit,
  teams,
  users,
  categories,
  departments,
}: {
  asset: Asset;
  onEdit: (id: string, data: Partial<Asset>) => void;
  teams: Team[];
  users: User[];
  categories: Category[];
  departments: string[];
}) {
  const [open, setOpen] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string>(
    asset.categoryId || "",
  );
  const [selectedDept, setSelectedDept] = useState<string>("");

  const currentDays = asset.inspectionCycleDays;
  const presetMatch = CYCLE_OPTIONS.find(
    (o) => o.value !== "custom" && parseInt(o.value) === currentDays,
  );
  const [cycleSelectValue, setCycleSelectValue] = useState<string>(
    presetMatch ? presetMatch.value : "custom",
  );
  const [customCycleDays, setCustomCycleDays] = useState<string>(
    presetMatch ? "" : String(currentDays),
  );

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      name: asset.name,
      serialNumber: asset.serialNumber,
      categoryId: asset.categoryId || "",
      teamId: asset.teamId,
      managerId: asset.managerId,
      staffId: asset.staffId,
      lastInspectedDate: asset.lastInspectedDate,
      notes: asset.notes || "",
    },
  });

  const watchedTeamId = watch("teamId");
  const staffMembers = users.filter(
    (u) => u.role === "staff" && u.teamId === watchedTeamId,
  );
  const editCategory = categories.find((c) => c.id === editCategoryId);
  const editCategoryManagers = (editCategory?.managerIds || [])
    .map((mid) => users.find((u) => u.id === mid))
    .filter(Boolean);

  const effectiveCycleDays =
    cycleSelectValue === "custom"
      ? parseInt(customCycleDays) || 0
      : parseInt(cycleSelectValue) || 0;
  const watchedLastDate = watch("lastInspectedDate");

  const filteredTeams = selectedDept
    ? teams.filter((t) => t.department === selectedDept)
    : [];

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
      const pm = CYCLE_OPTIONS.find(
        (o) =>
          o.value !== "custom" &&
          parseInt(o.value) === asset.inspectionCycleDays,
      );
      setCycleSelectValue(pm ? pm.value : "custom");
      setCustomCycleDays(pm ? "" : String(asset.inspectionCycleDays));
      setEditCategoryId(asset.categoryId || "");
      setValue("lastInspectedDate", asset.lastInspectedDate);
      const team = teams.find((t) => t.id === asset.teamId);
      if (team?.department) {
        setSelectedDept(team.department);
      }
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
          <DialogDescription>장비 정보를 수정합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">대상</Label>
              <Input id="edit-name" {...register("name", { required: true })} />
            </div>
            {editCategoryManagers.length > 0 && (
              <div className="space-y-2">
                <Label>구분 관리자</Label>
                <Select
                  value={watch("managerId")}
                  onValueChange={(v) => setValue("managerId", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {editCategoryManagers.map(
                      (u) =>
                        u && (
                          <SelectItem key={u.id} value={u.id}>
                            {u.username}
                          </SelectItem>
                        ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-serial">추가정보</Label>
              <Input
                id="edit-serial"
                {...register("serialNumber", { required: true })}
                placeholder="Number, Code 등"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-notes">추가정보2</Label>
              <Input
                id="edit-notes"
                {...register("notes")}
                placeholder="기타(오차량 등)"
                data-testid="input-edit-asset-notes"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>담당 부서</Label>
              <Select
                value={selectedDept}
                onValueChange={(v) => {
                  setSelectedDept(v);
                  setValue("teamId", "");
                  setValue("staffId", "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="부서 선택" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>담당팀</Label>
              <Select
                value={watch("teamId")}
                onValueChange={(v) => {
                  setValue("teamId", v);
                  const teamStaff = users.filter(
                    (u) => u.role === "staff" && u.teamId === v,
                  );
                  if (teamStaff.length > 0) {
                    setValue("staffId", teamStaff[0].id);
                  } else {
                    setValue("staffId", "");
                  }
                }}
                disabled={!selectedDept}
              >
                <SelectTrigger>
                  <SelectValue placeholder="팀 선택" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>담당자</Label>
              <Select
                value={watch("staffId")}
                onValueChange={(v) => setValue("staffId", v)}
                disabled={!watch("teamId")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.length > 0 ? (
                    staffMembers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.username}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      해당 팀에 소속된 담당자가 없습니다
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>최근 점검일</Label>
              <Input
                type="date"
                {...register("lastInspectedDate")}
                onChange={(e) => setValue("lastInspectedDate", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1">
            <CycleSelector
              value={cycleSelectValue}
              onChange={setCycleSelectValue}
              customValue={customCycleDays}
              onCustomChange={setCustomCycleDays}
            />
          </div>

          {watchedLastDate && effectiveCycleDays > 0 && (
            <InspectionCyclePreview
              lastDate={watchedLastDate}
              cycleDays={effectiveCycleDays}
            />
          )}

          <DialogFooter>
            <Button type="submit">저장</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAssetDialog({
  asset,
  onDelete,
}: {
  asset: Asset;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          삭제
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>장비 삭제</DialogTitle>
          <DialogDescription>
            정말로 <strong>{asset.name}</strong> 장비를 삭제하시겠습니까? 이
            작업은 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onDelete(asset.id);
              setOpen(false);
            }}
          >
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddAssetDialog({
  teams,
  users,
  categories,
  currentUser,
  departments,
}: {
  teams: Team[];
  users: User[];
  categories: Category[];
  currentUser: User | null;
  departments: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [cycleSelectValue, setCycleSelectValue] = useState<string>("");
  const [customCycleDays, setCustomCycleDays] = useState<string>("");
  const [lastDate, setLastDate] = useState<string>("");
  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const managers = users.filter((u) => u.role === "manager");
  const filteredTeams = selectedDept
    ? teams.filter((t) => t.department === selectedDept)
    : [];
  const staffMembers = selectedTeamId
    ? users.filter((u) => u.role === "staff" && u.teamId === selectedTeamId)
    : [];
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const categoryManagers = (selectedCategory?.managerIds || [])
    .map((mid) => users.find((u) => u.id === mid))
    .filter(Boolean);

  const effectiveCycleDays =
    cycleSelectValue === "custom"
      ? parseInt(customCycleDays) || 0
      : parseInt(cycleSelectValue) || 0;

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      return api.assets.create({
        name: data.name,
        serialNumber: data.serialNumber,
        categoryId: data.categoryId,
        teamId: data.teamId,
        managerId:
          data.managerId ||
          (selectedCategory?.managerIds &&
          selectedCategory.managerIds.length > 0
            ? selectedCategory.managerIds[0]
            : null) ||
          currentUser?.id ||
          managers[0]?.id,
        usageTeamId: data.teamId,
        staffId: data.staffId || staffMembers[0]?.id,
        inspectionCycleDays: effectiveCycleDays,
        lastInspectedDate: data.lastInspectedDate,
        inspectorId: currentUser?.id,
        notes: data.notes || null,
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
      setSelectedDept("");
      setSelectedTeamId("");
      toast({
        title: "장비 등록 완료",
        description: "새로운 장비가 성공적으로 등록되었습니다.",
      });
    },
  });

  const onSubmit = (data: any) => {
    if (effectiveCycleDays <= 0) {
      toast({
        title: "입력 오류",
        description: "점검 주기를 선택하거나 1 이상의 숫자를 입력해주세요.",
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
      setSelectedCategoryId("");
      setSelectedDept("");
      setSelectedTeamId("");
      setCycleSelectValue("");
      setCustomCycleDays("");
      setLastDate("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-asset">
          <Plus className="w-4 h-4" /> 장비 등록
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>신규 장비 등록</DialogTitle>
          <DialogDescription>새로운 장비를 등록합니다.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>구분</Label>
              <Select
                onValueChange={(v) => {
                  setValue("categoryId", v);
                  setSelectedCategoryId(v);
                  const cat = categories.find((c) => c.id === v);
                  if (cat?.managerIds && cat.managerIds.length > 0) {
                    setValue("managerId", cat.managerIds[0]);
                  }
                  if (cat?.defaultCycleDays) {
                    const preset = CYCLE_OPTIONS.find(
                      (o) =>
                        o.value !== "custom" &&
                        parseInt(o.value) === cat.defaultCycleDays,
                    );
                    if (preset) {
                      setCycleSelectValue(preset.value);
                      setCustomCycleDays("");
                    } else {
                      setCycleSelectValue("custom");
                      setCustomCycleDays(String(cat.defaultCycleDays));
                    }
                  }
                }}
              >
                <SelectTrigger data-testid="select-asset-category">
                  <SelectValue placeholder="구분 선택" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">대상</Label>
              <Input
                id="name"
                {...register("name", { required: true })}
                placeholder="예: 정밀 저울"
                data-testid="input-asset-name"
              />
            </div>
          </div>

          {categoryManagers.length > 1 && (
            <div className="space-y-2">
              <Label>구분 관리자</Label>
              <Select
                defaultValue={categoryManagers[0]?.id}
                onValueChange={(v) => setValue("managerId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="관리자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {categoryManagers.map(
                    (u) =>
                      u && (
                        <SelectItem key={u.id} value={u.id}>
                          {u.username}
                        </SelectItem>
                      ),
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serial">추가정보</Label>
              <Input
                id="serial"
                {...register("serialNumber", { required: true })}
                placeholder="Number, Code 등"
                data-testid="input-asset-serial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-notes">추가정보2</Label>
              <Input
                id="add-notes"
                {...register("notes")}
                placeholder="기타(오차량 등)"
                data-testid="input-asset-notes"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>담당 부서</Label>
              <Select
                value={selectedDept}
                onValueChange={(v) => {
                  setSelectedDept(v);
                  setSelectedTeamId("");
                  setValue("teamId", "");
                  setValue("staffId", "");
                }}
              >
                <SelectTrigger data-testid="select-asset-dept">
                  <SelectValue placeholder="부서 선택" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className="max-h-60 overflow-y-auto"
                >
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>담당팀</Label>
              <Select
                value={selectedTeamId}
                onValueChange={(v) => {
                  setSelectedTeamId(v);
                  setValue("teamId", v);
                  const teamStaff = users.filter(
                    (u) => u.role === "staff" && u.teamId === v,
                  );
                  if (teamStaff.length > 0) {
                    setValue("staffId", teamStaff[0].id);
                  } else {
                    setValue("staffId", "");
                  }
                }}
                disabled={!selectedDept}
              >
                <SelectTrigger data-testid="select-asset-team">
                  <SelectValue placeholder="팀 선택" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>담당자</Label>
              <Select
                value={watch("staffId")}
                onValueChange={(v) => setValue("staffId", v)}
                disabled={!selectedTeamId}
              >
                <SelectTrigger data-testid="select-asset-staff">
                  <SelectValue
                    placeholder={
                      selectedTeamId
                        ? "담당자 선택"
                        : "담당팀을 먼저 선택하세요"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.length > 0 ? (
                    staffMembers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.username}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      해당 팀에 소속된 담당자가 없습니다
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
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
                data-testid="input-asset-last-date"
              />
            </div>
          </div>

          <div className="grid grid-cols-1">
            <CycleSelector
              value={cycleSelectValue}
              onChange={setCycleSelectValue}
              customValue={customCycleDays}
              onCustomChange={setCustomCycleDays}
            />
          </div>

          {lastDate && effectiveCycleDays > 0 && (
            <InspectionCyclePreview
              lastDate={lastDate}
              cycleDays={effectiveCycleDays}
            />
          )}

          <DialogFooter className="mt-4">
            <Button type="submit" data-testid="button-submit-asset">
              등록 완료
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
