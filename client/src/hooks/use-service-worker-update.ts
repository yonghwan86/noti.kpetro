import { useEffect, useState } from "react";

export function useServiceWorkerUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    function onUpdateFound(this: ServiceWorkerRegistration) {
      const reg = this;
      const newWorker = reg.installing;
      if (!newWorker) return;
      const onStateChange = () => {
        if (!cancelled && newWorker.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(newWorker);
        }
      };
      newWorker.addEventListener("statechange", onStateChange);
    }

    let registration: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker.ready.then((reg) => {
      if (cancelled) return;
      registration = reg;

      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(reg.waiting);
        return;
      }

      reg.addEventListener("updatefound", onUpdateFound);
    });

    let refreshing = false;
    const onControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (registration) {
        registration.removeEventListener("updatefound", onUpdateFound);
      }
    };
  }, []);

  function applyUpdate() {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  }

  return { waitingWorker, applyUpdate };
}
