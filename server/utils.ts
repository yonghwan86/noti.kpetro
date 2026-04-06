export function toKSTDateStr(scheduledAt: string): string {
  return new Date(scheduledAt).toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });
}

export function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}
