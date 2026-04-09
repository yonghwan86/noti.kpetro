export function toKSTDateStr(scheduledAt: string): string {
  // 2026-04-09 타임존 없는 값은 이미 KST 기준으로 저장된 것이므로 날짜 부분만 추출
  if (
    !scheduledAt.endsWith("Z") &&
    !scheduledAt.includes("+") &&
    !scheduledAt.includes("-", 10)
  ) {
    return scheduledAt.slice(0, 10);
  }
  // 타임존 정보가 있는 경우 (예: "2026-04-07T09:50:24.050Z") 기존 변환 유지
  return new Date(scheduledAt).toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });
}

export function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}
