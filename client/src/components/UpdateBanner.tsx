import { RefreshCw } from "lucide-react";
import { useServiceWorkerUpdate } from "@/hooks/use-service-worker-update";

export function UpdateBanner() {
  const { waitingWorker, applyUpdate } = useServiceWorkerUpdate();

  if (!waitingWorker) return null;

  return (
    <div
      data-testid="banner-sw-update"
      className="flex w-full items-center justify-center gap-3 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md"
      role="alert"
      aria-live="polite"
    >
      <RefreshCw className="h-4 w-4 shrink-0" />
      <span>새 버전이 출시되었습니다</span>
      <button
        data-testid="button-apply-sw-update"
        onClick={applyUpdate}
        className="ml-2 rounded border border-primary-foreground/40 px-3 py-0.5 text-xs font-semibold hover:bg-primary-foreground/10 transition-colors"
      >
        지금 업데이트
      </button>
    </div>
  );
}
