import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, Shield, Save } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "설정 저장됨",
      description: "시스템 설정이 성공적으로 업데이트되었습니다.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">설정</h2>
        <p className="text-muted-foreground">
          시스템 환경설정 및 알림 규칙을 관리합니다.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <CardTitle>알림 설정</CardTitle>
            </div>
            <CardDescription>
              점검 주기 도래 시 알림 발송 규칙을 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">이메일 알림</Label>
                <p className="text-sm text-muted-foreground">
                  점검 예정일 7일 전 담당자에게 이메일 발송
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">슬랙(Slack) 연동</Label>
                <p className="text-sm text-muted-foreground">
                  팀 채널에 점검 리포트 자동 전송
                </p>
              </div>
              <Switch />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">점검 지연 경고</Label>
                <p className="text-sm text-muted-foreground">
                  점검일 초과 시 관리자에게 매일 알림
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* System Params */}
        <Card>
          <CardHeader>
             <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle>시스템 파라미터</CardTitle>
            </div>
            <CardDescription>
              기본 점검 주기 및 임계값을 설정합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>기본 점검 주기 (개월)</Label>
              <Input type="number" defaultValue={6} className="max-w-[200px]" />
              <p className="text-xs text-muted-foreground">신규 장비 등록 시 기본값으로 사용됩니다.</p>
            </div>
            <div className="grid gap-2">
              <Label>임박 알림 기준일 (일)</Label>
              <Input type="number" defaultValue={7} className="max-w-[200px]" />
              <p className="text-xs text-muted-foreground">점검일 며칠 전부터 '임박' 상태로 표시할지 설정합니다.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" /> 설정 저장
          </Button>
        </div>
      </div>
    </div>
  );
}
