import { useState, useEffect, useCallback } from "react";
import { BellRing, BellOff, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

type PushState = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const checkSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState(subscription ? "subscribed" : "unsubscribed");
    } catch {
      setState("unsubscribed");
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const subscribe = async () => {
    setIsProcessing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        toast({
          title: "알림 권한 거부됨",
          description: "브라우저 설정에서 알림을 허용해주세요.",
          variant: "destructive",
        });
        return;
      }

      const res = await fetch("/api/push/vapid-key");
      const { publicKey } = await res.json();

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJson = subscription.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });

      setState("subscribed");
      toast({
        title: "푸시 알림 활성화",
        description: "점검 알림을 푸시로 받을 수 있습니다.",
      });
    } catch (err: any) {
      console.error("Push subscribe error:", err);
      toast({
        title: "알림 등록 실패",
        description: err.message || "다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const unsubscribe = async () => {
    setIsProcessing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("unsubscribed");
      toast({
        title: "푸시 알림 해제",
        description: "더 이상 푸시 알림을 받지 않습니다.",
      });
    } catch (err: any) {
      console.error("Push unsubscribe error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (state === "loading" || state === "unsupported") return null;

  const getTooltipText = () => {
    switch (state) {
      case "denied": return "브라우저에서 알림이 차단됨";
      case "subscribed": return "푸시 알림 켜짐 (클릭하여 해제)";
      case "unsubscribed": return "푸시 알림 켜기";
      default: return "";
    }
  };

  const getIcon = () => {
    switch (state) {
      case "denied": return <BellOff className="h-5 w-5" />;
      case "subscribed": return <BellRing className="h-5 w-5" />;
      case "unsubscribed": return <Bell className="h-5 w-5" />;
      default: return <Bell className="h-5 w-5" />;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={state === "denied" || isProcessing}
            onClick={state === "subscribed" ? unsubscribe : subscribe}
            className={`relative ${state === "subscribed" ? "text-blue-500" : "text-muted-foreground"}`}
            data-testid="button-push-toggle"
          >
            {getIcon()}
            {state === "subscribed" && (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-background" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PushNotificationBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const checkIfNeeded = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (Notification.permission === "denied") return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const dismissed = sessionStorage.getItem("push-banner-dismissed");
          if (!dismissed) setShow(true);
        }
      } catch {
      }
    };
    const timer = setTimeout(checkIfNeeded, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    sessionStorage.setItem("push-banner-dismissed", "true");
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-3" data-testid="banner-push-notification">
      <div className="flex items-center gap-2">
        <BellRing className="h-5 w-5 text-blue-500 shrink-0" />
        <p className="text-sm text-blue-700">
          푸시 알림을 켜면 점검 일정을 놓치지 않을 수 있습니다. 상단 🔔 아이콘을 눌러 활성화하세요.
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={dismiss} className="text-blue-500 shrink-0" data-testid="button-dismiss-push-banner">
        닫기
      </Button>
    </div>
  );
}
