import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  PersonalTask,
  Team,
  User,
  ShareScope,
  RepeatType,
  Asset,
  CreatePersonalTaskPayload,
  UpdatePersonalTaskPayload,
  TaskFilter,
} from "@/lib/types";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  parseISO,
  isToday,
  isThisWeek,
  isPast,
  isFuture,
  addMonths,
  startOfMonth,
} from "date-fns";
import { ko } from "date-fns/locale";
import {
  Plus,
  Calendar,
  Check,
  Trash2,
  Edit,
  Users,
  Lock,
  Building,
  Share2,
  Clock,
  CalendarCheck,
  Filter,
  Repeat,
  List,
  CalendarDays,
} from "lucide-react";
import ShareTargetSelector from "@/components/ShareTargetSelector";
import CalendarView from "@/components/CalendarView";

type TaskWithShared = PersonalTask & { isShared?: boolean };

const formatDateShort = (dateStr: string) => {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
};

export default function MySchedule() {
  const { currentUser } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithShared | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [previewTask, setPreviewTask] = useState<TaskWithShared | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("09:00");
  const [repeatType, setRepeatType] = useState<RepeatType>("none");
  const [shareScope, setShareScope] = useState<ShareScope>("private");
  const [shareTeamIds, setShareTeamIds] = useState<string[]>([]);
  const [shareUserIds, setShareUserIds] = useState<string[]>([]);
  const [isRangeEnabled, setIsRangeEnabled] = useState(false);
  const [scheduledEndAt, setScheduledEndAt] = useState("");
  const [label, setLabel] = useState<string | null>(null);
  const [priority, setPriority] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const { data: tasks = [], isLoading } = useQuery<TaskWithShared[]>({
    queryKey: ["/api/personal-tasks"],
    queryFn: () => api.personalTasks.getAll(),
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: () => api.teams.getAll(),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => api.users.getAll(),
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/assets"],
    queryFn: () => api.assets.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePersonalTaskPayload) =>
      api.personalTasks.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-tasks"] });
      toast({ title: "일정이 등록되었습니다." });
      closeDialog();
    },
    onError: (e: any) =>
      toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdatePersonalTaskPayload;
    }) => api.personalTasks.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-tasks"] });
      toast({ title: "일정이 수정되었습니다." });
      closeDialog();
    },
    onError: (e: any) =>
      toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.personalTasks.toggleComplete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/personal-tasks"] }),
    onError: (e: any) =>
      toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.personalTasks.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-tasks"] });
      toast({ title: "일정이 삭제되었습니다." });
    },
    onError: (e: any) =>
      toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const checklistMutation = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string }) =>
      api.personalTasks.update(id, { description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal-tasks"] });
    },
    onError: (e: any) =>
      toast({ title: "오류", description: e.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setScheduledAt("");
    setSchedDate("");
    setSchedTime("09:00");
    setRepeatType("none");
    setShareScope("private");
    setShareTeamIds([]);
    setShareUserIds([]);
    setIsRangeEnabled(false);
    setScheduledEndAt("");
    setLabel(null);
    setPriority(0);
  };

  const openCreate = (date?: Date) => {
    closeDialog();
    if (date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      setSchedDate(dateStr);
      setSchedTime("09:00");
      setScheduledAt(`${dateStr}T09:00`);
    }
    setDialogOpen(true);
  };

  const openEdit = (task: TaskWithShared) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setScheduledAt(task.scheduledAt);
    const [datePart, timePart] = task.scheduledAt.split("T");
    setSchedDate(datePart || "");
    setSchedTime(timePart ? timePart.slice(0, 5) : "09:00");
    setRepeatType(task.repeatType as RepeatType);
    const scope = task.shareScope;
    const mappedScope: ShareScope =
      scope === "team" || scope === "department" || scope === "custom"
        ? "selected"
        : (scope as ShareScope);
    setShareScope(mappedScope);
    setShareTeamIds(task.shareTeamIds || []);
    setShareUserIds(task.shareUserIds || []);
    setIsRangeEnabled(!!task.scheduledEndAt);
    setScheduledEndAt(task.scheduledEndAt || "");
    setLabel(task.label ?? null);
    setPriority(task.priority ?? 0);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!title.trim() || !scheduledAt) {
      toast({
        title: "제목과 일정 시간을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    if (isRangeEnabled && !scheduledEndAt) {
      toast({ title: "종료일을 입력해주세요.", variant: "destructive" });
      return;
    }
    const data: any = {
      title: title.trim(),
      description: description.trim() || null,
      scheduledAt,
      repeatType: isRangeEnabled ? "none" : repeatType,
      scheduledEndAt: isRangeEnabled && scheduledEndAt ? scheduledEndAt : null,
      shareScope,
      shareTeamIds: shareScope === "selected" ? shareTeamIds : [],
      shareUserIds: shareScope === "selected" ? shareUserIds : [],
      label,
      priority,
    };

    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data });
    } else {
      data.userId = currentUser?.id || "";
      data.completed = false;
      createMutation.mutate(data);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "mine") return !t.isShared;
    if (filter === "shared") return t.isShared;
    if (filter === "today") {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const start = format(parseISO(t.scheduledAt), "yyyy-MM-dd");
      const end = t.scheduledEndAt ?? start;
      return start <= todayStr && todayStr <= end;
    }
    if (filter === "completed") return t.completed;
    return true;
  });

  const incompleteTasks = filteredTasks
    .filter((t) => !t.completed)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const completedTasks = filteredTasks.filter((t) => t.completed);

  const getShareIcon = (scope: string) => {
    if (scope === "private") return <Lock className="h-3 w-3" />;
    return <Share2 className="h-3 w-3" />;
  };

  const getShareLabel = (scope: string) => {
    if (scope === "private") return "나만 보기";
    return "공유";
  };

  const getRepeatLabel = (type: string) => {
    switch (type) {
      case "daily":
        return "매일";
      case "weekly":
        return "매주";
      case "monthly":
        return "매월";
      default:
        return null;
    }
  };

  const getUserName = (userId: string) =>
    users.find((u) => u.id === userId)?.username || "알 수 없음";

  const getScheduleStatus = (task: TaskWithShared) => {
    if (task.completed)
      return { label: "완료", color: "bg-green-100 text-green-800" };
    if (task.scheduledEndAt) {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const startStr = format(parseISO(task.scheduledAt), "yyyy-MM-dd");
      if (task.scheduledEndAt < todayStr)
        return { label: "지남", color: "bg-red-100 text-red-800" };
      if (startStr <= todayStr && todayStr <= task.scheduledEndAt)
        return { label: "진행중", color: "bg-purple-100 text-purple-800" };
      return { label: "예정", color: "bg-gray-100 text-gray-800" };
    }
    const date = parseISO(task.scheduledAt);
    if (isPast(date))
      return { label: "지남", color: "bg-red-100 text-red-800" };
    if (isToday(date))
      return { label: "오늘", color: "bg-blue-100 text-blue-800" };
    if (isThisWeek(date))
      return { label: "이번주", color: "bg-yellow-100 text-yellow-800" };
    return { label: "예정", color: "bg-gray-100 text-gray-800" };
  };

  const labelConfig: Record<string, { label: string; className: string }> = {
    inspection: {
      label: "내부회의",
      className: "bg-amber-100 text-amber-800",
    },
    meeting: { label: "외부회의", className: "bg-blue-100 text-blue-800" },
    trip: { label: "출장", className: "bg-green-100 text-green-800" },
    training: { label: "교육", className: "bg-purple-100 text-purple-800" },
    other: { label: "기타", className: "bg-gray-100 text-gray-800" },
  };

  const getPriorityBadge = (p: number) => {
    if (p === 3)
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 bg-red-100 text-red-800"
        >
          긴급
        </Badge>
      );
    if (p === 2)
      return (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-800"
        >
          높음
        </Badge>
      );
    return null;
  };

  const renderDescription = (task: TaskWithShared, isOwner: boolean) => {
    const desc = task.description;
    if (!desc) return null;
    const lines = desc.split("\n");
    const hasChecklist = lines.some((l) => /^- \[[ x]\]/.test(l));
    if (!hasChecklist) {
      return (
        <p className="text-xs text-muted-foreground mt-1 truncate">{desc}</p>
      );
    }
    return (
      <div className="mt-1 space-y-0.5">
        {lines.map((line, i) => {
          const checkedMatch = line.match(/^- \[( |x)\] (.*)/);
          if (checkedMatch) {
            const checked = checkedMatch[1] === "x";
            const text = checkedMatch[2];
            return (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!isOwner}
                  data-testid={`checklist-item-${task.id}-${i}`}
                  className="h-3.5 w-3.5 accent-primary cursor-pointer disabled:cursor-default"
                  onChange={() => {
                    const newLines = [...lines];
                    newLines[i] = checked ? `- [ ] ${text}` : `- [x] ${text}`;
                    checklistMutation.mutate({
                      id: task.id,
                      description: newLines.join("\n"),
                    });
                  }}
                />
                <span
                  className={`text-xs ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}
                >
                  {text}
                </span>
              </div>
            );
          }
          if (line.trim())
            return (
              <p key={i} className="text-xs text-muted-foreground">
                {line}
              </p>
            );
          return null;
        })}
      </div>
    );
  };

  const renderTask = (task: TaskWithShared) => {
    const status = getScheduleStatus(task);
    const isOwner = task.userId === currentUser?.id;

    return (
      <div
        key={task.id}
        data-testid={`task-item-${task.id}`}
        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
          task.completed ? "bg-muted/50 opacity-60" : "hover:bg-accent/50"
        }`}
      >
        {isOwner && (
          <button
            data-testid={`toggle-task-${task.id}`}
            onClick={() => toggleMutation.mutate(task.id)}
            className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              task.completed
                ? "bg-green-500 border-green-500 text-white"
                : "border-gray-300 hover:border-primary"
            }`}
          >
            {task.completed && <Check className="h-3 w-3" />}
          </button>
        )}
        {!isOwner && (
          <div className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
            <Share2 className="h-3 w-3 text-blue-500" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}
            >
              {task.title}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${status.color}`}
            >
              {status.label}
            </Badge>
            {task.isShared && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700"
              >
                공유받음
              </Badge>
            )}
            {!task.isShared && task.shareScope !== "private" && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 gap-0.5"
              >
                {getShareIcon(task.shareScope)}
                {getShareLabel(task.shareScope)}
              </Badge>
            )}
            {getRepeatLabel(task.repeatType) && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 gap-0.5"
              >
                <Repeat className="h-3 w-3" />
                {getRepeatLabel(task.repeatType)}
              </Badge>
            )}
            {task.label && labelConfig[task.label] && (
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${labelConfig[task.label].className}`}
              >
                {labelConfig[task.label].label}
              </Badge>
            )}
            {getPriorityBadge(task.priority ?? 0)}
          </div>
          {renderDescription(task, isOwner)}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.scheduledEndAt
                ? `${formatDateShort(format(parseISO(task.scheduledAt), "yyyy-MM-dd"))} ~ ${formatDateShort(task.scheduledEndAt)}`
                : format(parseISO(task.scheduledAt), "yyyy-MM-dd HH:mm", {
                    locale: ko,
                  })}
            </span>
            {task.isShared && <span>작성자: {getUserName(task.userId)}</span>}
          </div>
        </div>

        {isOwner && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              data-testid={`edit-task-${task.id}`}
              onClick={() => openEdit(task)}
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              data-testid={`delete-task-${task.id}`}
              onClick={() => {
                if (confirm("이 일정을 삭제할까요?")) {
                  deleteMutation.mutate(task.id);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              내 일정
            </h2>
            <p className="text-sm text-muted-foreground hidden sm:block">
              개인 업무 일정을 관리하고 알림을 받으세요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("list")}
              data-testid="toggle-view-list"
            >
              <List className="h-4 w-4 mr-1" />
              목록
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("calendar")}
              data-testid="toggle-view-calendar"
            >
              <CalendarDays className="h-4 w-4 mr-1" />
              캘린더
            </Button>
          </div>
          <Button onClick={() => openCreate()} data-testid="button-create-task">
            <Plus className="h-4 w-4 mr-2" />
            일정 등록
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "전체", icon: CalendarCheck },
          { key: "mine", label: "내 일정", icon: Lock },
          { key: "shared", label: "공유받은", icon: Share2 },
          { key: "today", label: "오늘", icon: Calendar },
          { key: "completed", label: "완료", icon: Check },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key as any)}
            data-testid={`filter-${f.key}`}
          >
            <f.icon className="h-3.5 w-3.5 mr-1" />
            {f.label}
            {f.key === "all" && (
              <span className="ml-1 text-xs">({tasks.length})</span>
            )}
            {f.key === "mine" && (
              <span className="ml-1 text-xs">
                ({tasks.filter((t) => !t.isShared).length})
              </span>
            )}
            {f.key === "shared" && (
              <span className="ml-1 text-xs">
                ({tasks.filter((t) => t.isShared).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {viewMode === "list" ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                진행 중 ({incompleteTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : incompleteTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {filter === "shared"
                    ? "공유받은 일정이 없습니다."
                    : "등록된 일정이 없습니다."}
                </p>
              ) : (
                <div className="space-y-2">
                  {incompleteTasks.map(renderTask)}
                </div>
              )}
            </CardContent>
          </Card>

          {completedTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                  <Check className="h-4 w-4" />
                  완료됨 ({completedTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {completedTasks.map(renderTask)}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <CalendarView
          tasks={filteredTasks}
          allTasks={tasks.filter((t) => !t.completed)}
          assets={[]}
          filter={filter}
          calendarMonth={calendarMonth}
          onPrevMonth={() => setCalendarMonth((prev) => addMonths(prev, -1))}
          onNextMonth={() => setCalendarMonth((prev) => addMonths(prev, 1))}
          onToday={() => setCalendarMonth(startOfMonth(new Date()))}
          onDateClick={(date) => openCreate(date)}
          onTaskClick={(task) => setPreviewTask(task)}
        />
      )}

      {/* 캘린더 일정 상세 보기 팝업 */}
      <Dialog
        open={!!previewTask}
        onOpenChange={(open) => !open && setPreviewTask(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{previewTask?.title}</DialogTitle>
          </DialogHeader>
          {previewTask &&
            (() => {
              const status = getScheduleStatus(previewTask);
              const isOwner = previewTask.userId === currentUser?.id;
              return (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={`text-xs ${status.color}`}
                    >
                      {status.label}
                    </Badge>
                    {previewTask.isShared && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-blue-50 text-blue-700"
                      >
                        공유받음
                      </Badge>
                    )}
                    {!previewTask.isShared &&
                      previewTask.shareScope !== "private" && (
                        <Badge variant="outline" className="text-xs gap-0.5">
                          {getShareIcon(previewTask.shareScope)}
                          {getShareLabel(previewTask.shareScope)}
                        </Badge>
                      )}
                    {previewTask.label && labelConfig[previewTask.label] && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${labelConfig[previewTask.label].className}`}
                      >
                        {labelConfig[previewTask.label].label}
                      </Badge>
                    )}
                    {getPriorityBadge(previewTask.priority ?? 0)}
                    {getRepeatLabel(previewTask.repeatType) && (
                      <Badge variant="outline" className="text-xs gap-0.5">
                        <Repeat className="h-3 w-3" />
                        {getRepeatLabel(previewTask.repeatType)}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {previewTask.scheduledEndAt
                        ? `${formatDateShort(format(parseISO(previewTask.scheduledAt), "yyyy-MM-dd"))} ~ ${formatDateShort(previewTask.scheduledEndAt)}`
                        : format(
                            parseISO(previewTask.scheduledAt),
                            "yyyy-MM-dd HH:mm",
                            { locale: ko },
                          )}
                    </div>
                    {previewTask.isShared && (
                      <div className="text-muted-foreground">
                        작성자: {getUserName(previewTask.userId)}
                      </div>
                    )}
                    {previewTask.description && (
                      <p className="text-muted-foreground whitespace-pre-wrap border-t pt-2">
                        {previewTask.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          <DialogFooter>
            {previewTask?.userId === currentUser?.id && (
              <Button
                onClick={() => {
                  const t = previewTask;
                  setPreviewTask(null);
                  openEdit(t!);
                }}
              >
                <Edit className="h-4 w-4 mr-1" /> 수정
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 일정 등록/수정 다이얼로그 */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "일정 수정" : "새 일정 등록"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[70vh] px-1 pb-4">
            <div>
              <label className="text-sm font-medium">제목 *</label>
              <Input
                data-testid="input-task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="일정 제목을 입력하세요"
              />
            </div>
            <div>
              <label className="text-sm font-medium">설명</label>
              <Textarea
                data-testid="input-task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={"일정 설명 (선택)\n체크리스트: - [ ] 할 일"}
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">일정 날짜/시간 *</label>
              <div className="flex gap-2">
                <Input
                  data-testid="input-task-date"
                  type="date"
                  value={schedDate}
                  className="flex-1"
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setSchedDate(newDate);
                    const combined = newDate ? `${newDate}T${schedTime}` : "";
                    setScheduledAt(combined);
                    if (
                      isRangeEnabled &&
                      scheduledEndAt &&
                      newDate > scheduledEndAt
                    ) {
                      setScheduledEndAt(newDate);
                    }
                  }}
                />
                <Input
                  data-testid="input-task-time"
                  type="time"
                  value={schedTime}
                  className="w-32"
                  onChange={(e) => {
                    const newTime = e.target.value;
                    setSchedTime(newTime);
                    const combined = schedDate ? `${schedDate}T${newTime}` : "";
                    setScheduledAt(combined);
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                data-testid="toggle-range-enabled"
                checked={isRangeEnabled}
                onCheckedChange={(v) => {
                  setIsRangeEnabled(v);
                  if (!v) setScheduledEndAt("");
                }}
              />
              <label className="text-sm">기간 설정</label>
            </div>
            {isRangeEnabled && (
              <div>
                <label className="text-sm font-medium">종료일 *</label>
                <Input
                  data-testid="input-task-end-date"
                  type="date"
                  value={scheduledEndAt}
                  min={scheduledAt.split("T")[0]}
                  onChange={(e) => setScheduledEndAt(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">라벨</label>
              <Select
                value={label ?? "none"}
                onValueChange={(v) => setLabel(v === "none" ? null : v)}
              >
                <SelectTrigger data-testid="select-task-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음</SelectItem>
                  <SelectItem value="inspection">내부회의</SelectItem>
                  <SelectItem value="meeting">외부회의</SelectItem>
                  <SelectItem value="trip">출장</SelectItem>
                  <SelectItem value="training">교육</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">우선순위</label>
              <Select
                value={String(priority)}
                onValueChange={(v) => setPriority(Number(v))}
              >
                <SelectTrigger data-testid="select-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">보통</SelectItem>
                  <SelectItem value="1">낮음</SelectItem>
                  <SelectItem value="2">높음</SelectItem>
                  <SelectItem value="3">긴급</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">반복</label>
              <Select
                value={isRangeEnabled ? "none" : repeatType}
                onValueChange={(v) => {
                  if (!isRangeEnabled) setRepeatType(v as RepeatType);
                }}
                disabled={isRangeEnabled}
              >
                <SelectTrigger data-testid="select-repeat-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">반복 없음</SelectItem>
                  <SelectItem value="daily">매일</SelectItem>
                  <SelectItem value="weekly">매주</SelectItem>
                  <SelectItem value="monthly">매월</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">공유 범위</label>
              <Select
                value={shareScope}
                onValueChange={(v) => {
                  setShareScope(v as ShareScope);
                  if (v === "private") {
                    setShareTeamIds([]);
                    setShareUserIds([]);
                  }
                }}
              >
                <SelectTrigger data-testid="select-share-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">나만 보기</SelectItem>
                  <SelectItem value="selected">직접 선택</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {shareScope === "selected" && (
              <div>
                <label className="text-sm font-medium">공유 대상</label>
                <div className="mt-1">
                  <ShareTargetSelector
                    teams={teams}
                    users={users.filter((u) => u.id !== currentUser?.id)}
                    selectedTeamIds={shareTeamIds}
                    selectedUserIds={shareUserIds}
                    onTeamIdsChange={setShareTeamIds}
                    onUserIdsChange={setShareUserIds}
                    currentUserTeamId={currentUser?.teamId}
                    currentUserDepartment={
                      teams.find((t) => t.id === currentUser?.teamId)
                        ?.department
                    }
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              data-testid="button-cancel-task"
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-task"
            >
              {editingTask ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
