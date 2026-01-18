import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { AlertCircle, LogIn } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Login() {
  const { isAuthenticated, isRegistered, authMessage, login, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardContent className="flex justify-center p-6">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAuthenticated && !isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">장비관리시스템</CardTitle>
            <CardDescription>접근 권한이 없습니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>등록되지 않은 사용자</AlertTitle>
              <AlertDescription>
                {authMessage || "이 이메일로 등록된 사용자가 없습니다. 관리자에게 문의하세요."}
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground text-center">
              시스템을 사용하려면 관리자가 먼저 사용자를 등록해야 합니다.
              등록된 이메일로 로그인해주세요.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={login} className="flex-1" data-testid="button-retry-login">
                다른 계정으로 로그인
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">장비관리시스템</CardTitle>
          <CardDescription>장비 점검 주기 및 팀별 장비 배정을 관리합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            로그인하여 시스템에 접근하세요.
            관리자가 미리 등록한 이메일로만 로그인할 수 있습니다.
          </p>
          <Button onClick={login} className="w-full" size="lg" data-testid="button-login-main">
            <LogIn className="mr-2 h-5 w-5" />
            로그인
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
