import { format, isSameMonth, isToday as isDateToday } from "date-fns";
import { ko } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getMonthGridDates,
  toDateKey,
  getTaskStartKey,
  getBarPosition,
} from "@/lib/calendarUtils";
import type { PersonalTask, Asset, TaskFilter } from "@/lib/types";

type TaskWithShared = PersonalTask & { isShared?: boolean };

interface CalendarViewProps {
  tasks: TaskWithShared[];
  allTasks: TaskWithShared[];
  assets: Asset[];
  filter: TaskFilter;
  calendarMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onDateClick: (date: Date) => void;
  onTaskClick: (task: TaskWithShared) => void;
}

export default function CalendarView({
  tasks,
  allTasks,
  assets,
  filter,
  calendarMonth,
  onPrevMonth,
  onNextMonth,
  onToday,
  onDateClick,
  onTaskClick,
}: CalendarViewProps) {
  const displayTasks = (() => {
    switch (filter) {
      case "completed":
        return tasks;
      case "today":
        return allTasks;
      case "all":
      case "mine":
      case "shared":
        return tasks.filter((t) => !t.completed);
      default: {
        const _exhaustive: never = filter;
        return tasks.filter((t) => !t.completed);
      }
    }
  })();

  const sortedTasks = [...displayTasks].sort((a, b) => {
    const pDiff = (b.priority || 0) - (a.priority || 0);
    if (pDiff !== 0) return pDiff;
    const aStart = getTaskStartKey(a);
    const bStart = getTaskStartKey(b);
    if (aStart !== bStart) return aStart < bStart ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  const gridDates = getMonthGridDates(calendarMonth);
  const rows: Date[][] = [];
  for (let i = 0; i < gridDates.length; i += 7) {
    rows.push(gridDates.slice(i, i + 7));
  }

  const renderCellContent = (
    dateKey: string,
    rowStartKey: string,
    rowEndKey: string,
  ) => {
    const cellItems: JSX.Element[] = [];

    for (const task of sortedTasks) {
      if (!task.scheduledEndAt) continue;
      const pos = getBarPosition(task, dateKey, rowStartKey, rowEndKey);
      if (!pos) continue;

      const isShared = !!task.isShared;
      const bgColor = isShared ? "bg-blue-500" : "bg-violet-500";
      const priorityBorder =
        task.priority === 3
          ? "border-l-2 border-red-400"
          : task.priority === 2
            ? "border-l-2 border-orange-400"
            : "";
      const roundedClass =
        pos === "start"
          ? "rounded-l-sm"
          : pos === "end"
            ? "rounded-r-sm"
            : pos === "single"
              ? "rounded-sm"
              : "";

      cellItems.push(
        <div
          key={`bar-${task.id}-${dateKey}`}
          data-testid={`calendar-task-${task.id}-${dateKey}`}
          className={`text-[10px] leading-4 px-1 py-0 text-white truncate cursor-pointer ${bgColor} ${roundedClass} ${priorityBorder}`}
          onClick={(e) => {
            e.stopPropagation();
            onTaskClick(task);
          }}
        >
          {pos === "start" || pos === "single" ? task.title : "\u00A0"}
        </div>,
      );
    }

    for (const task of sortedTasks) {
      if (task.scheduledEndAt) continue;
      if (getTaskStartKey(task) !== dateKey) continue;

      const isShared = !!task.isShared;
      const bgColor = isShared ? "bg-blue-500" : "bg-violet-500";
      const priorityBorder =
        task.priority === 3
          ? "border-l-2 border-red-400"
          : task.priority === 2
            ? "border-l-2 border-orange-400"
            : "";

      cellItems.push(
        <div
          key={`pill-${task.id}-${dateKey}`}
          data-testid={`calendar-task-${task.id}-${dateKey}`}
          className={`text-[10px] leading-4 px-1 py-0 text-white truncate rounded-sm cursor-pointer ${bgColor} ${priorityBorder}`}
          onClick={(e) => {
            e.stopPropagation();
            onTaskClick(task);
          }}
        >
          {task.title}
        </div>,
      );
    }

    const dueAssets = assets.filter(
      (a) => a.status !== "suspended" && a.nextDueDate === dateKey,
    );
    for (const asset of dueAssets.slice(0, 2)) {
      cellItems.push(
        <div
          key={`asset-${asset.id}`}
          className="text-[10px] leading-4 px-1 py-0 bg-amber-100 text-amber-800 border border-amber-300 rounded-sm truncate"
        >
          {asset.name.length > 8 ? asset.name.slice(0, 8) + "…" : asset.name}
        </div>,
      );
    }
    if (dueAssets.length > 2) {
      cellItems.push(
        <div key="asset-more" className="text-[9px] text-amber-600 px-1">
          +{dueAssets.length - 2}개
        </div>,
      );
    }

    return <div className="space-y-0.5">{cellItems}</div>;
  };

  return (
    <div>
      <div
        className="flex items-center justify-between mb-3"
        data-testid="calendar-header"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-base font-medium">
            {format(calendarMonth, "yyyy년 M월", { locale: ko })}
          </h3>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={onPrevMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onToday}
              data-testid="button-today"
            >
              오늘
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={onNextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          {allTasks.length > 0 && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                내 일정
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                공유받은
              </span>
            </>
          )}
          {assets.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              장비 점검
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-l">
        {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
          <div
            key={day}
            className={`py-2 text-center text-xs font-medium border-r ${
              i === 0
                ? "text-red-500"
                : i === 6
                  ? "text-blue-500"
                  : "text-muted-foreground"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="border-l">
        {rows.map((week, wi) => {
          const rowStartKey = toDateKey(week[0]);
          const rowEndKey = toDateKey(week[6]);
          return (
            <div key={wi} className="grid grid-cols-7">
              {week.map((date, di) => {
                const dateKey = toDateKey(date);
                const isCurrentMonth = isSameMonth(date, calendarMonth);
                const isTodayCell = isDateToday(date);
                return (
                  <div
                    key={dateKey}
                    data-testid={`calendar-cell-${dateKey}`}
                    className={`min-h-[80px] p-1 border-b border-r cursor-pointer hover:bg-accent/30 ${
                      !isCurrentMonth ? "bg-muted/30" : ""
                    }`}
                    onClick={() => onDateClick(date)}
                  >
                    <div
                      className={`text-xs mb-1 ${
                        isTodayCell
                          ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center ml-auto"
                          : !isCurrentMonth
                            ? "text-muted-foreground text-right"
                            : di === 0
                              ? "text-red-500 text-right"
                              : di === 6
                                ? "text-blue-500 text-right"
                                : "text-right"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                    {renderCellContent(dateKey, rowStartKey, rowEndKey)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
