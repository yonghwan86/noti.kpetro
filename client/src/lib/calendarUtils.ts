import { startOfMonth, startOfWeek, addDays, format, parseISO } from 'date-fns';
import type { PersonalTask } from './types';

/**
 * 월간 캘린더 grid에 표시할 날짜 배열 (항상 42개 = 6주 × 7일)
 * eachDayOfInterval 대신 addDays로 42칸 고정 — grid 높이 안정성 보장
 */
export function getMonthGridDates(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 }); // 일요일 시작
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Date → 'YYYY-MM-DD' */
export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * scheduledAt(datetime-local 형식 또는 ISO string) → 로컬 시간대 기준 'YYYY-MM-DD'
 * 기존 리스트 뷰(format(parseISO(...), 'yyyy-MM-dd'))와 동일 방식
 */
export function getTaskStartKey(task: PersonalTask): string {
  return format(parseISO(task.scheduledAt), 'yyyy-MM-dd');
}

/** scheduledEndAt 또는 startKey fallback */
export function getTaskEndKey(task: PersonalTask): string {
  return task.scheduledEndAt ?? getTaskStartKey(task);
}

/** 날짜 dateKey가 task 범위에 포함되는지 */
export function taskCoversDate(task: PersonalTask, dateKey: string): boolean {
  const start = getTaskStartKey(task);
  const end = getTaskEndKey(task);
  return start <= dateKey && dateKey <= end;
}

/**
 * 범위 일정에서 특정 날짜의 시각적 위치 (주 경계 보정 포함)
 *
 * @param rowStartKey — 해당 셀이 속한 주(행)의 첫째 날 YYYY-MM-DD (일요일)
 * @param rowEndKey   — 해당 셀이 속한 주(행)의 마지막 날 YYYY-MM-DD (토요일)
 *
 * 기간 일정이 주를 넘을 때:
 * - 행의 마지막 셀은 'end' (rounded-r) 으로 렌더링
 * - 다음 행의 첫 셀은 'start' (rounded-l) 으로 렌더링
 * → 각 행 내에서 독립적 bar 형태로 표시됨
 */
export function getBarPosition(
  task: PersonalTask,
  dateKey: string,
  rowStartKey: string,
  rowEndKey: string,
): 'start' | 'middle' | 'end' | 'single' | null {
  if (!taskCoversDate(task, dateKey)) return null;
  const taskStart = getTaskStartKey(task);
  const taskEnd = getTaskEndKey(task);
  if (taskStart === taskEnd) return 'single';

  const isVisualStart = dateKey === taskStart || dateKey === rowStartKey;
  const isVisualEnd = dateKey === taskEnd || dateKey === rowEndKey;

  if (isVisualStart && isVisualEnd) return 'single';
  if (isVisualStart) return 'start';
  if (isVisualEnd) return 'end';
  return 'middle';
}
