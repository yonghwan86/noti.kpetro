import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/contexts/UserContext";
import { AlertCircle, LogIn, KeyRound, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

type LoginStep = "email" | "password" | "set-password";

export default function Login() {
  const { isLoading, refetchAuth } = useUser();
  const { toast } = useToast();
  
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });

      const data = await res.json();

      if (!data.exists) {
        setError("등록되지 않은 이메일입니다. 관리자에게 문의하세요.");
        return;
      }

      setUsername(data.username);
      
      if (data.hasPassword) {
        setStep("password");
      } else {
        setStep("set-password");
      }
    } catch (err) {
      setError("이메일 확인 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needsPasswordSetup) {
          setStep("set-password");
          return;
        }
        setError(data.error || "로그인에 실패했습니다.");
        return;
      }

      toast({ title: "로그인 성공", description: `${data.user.fullName || data.user.username}님 환영합니다.` });
      refetchAuth();
    } catch (err) {
      setError("로그인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 4) {
      setError("비밀번호는 4자리 이상이어야 합니다.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "비밀번호 설정에 실패했습니다.");
        return;
      }

      toast({ title: "비밀번호 설정 완료", description: "로그인되었습니다." });
      refetchAuth();
    } catch (err) {
      setError("비밀번호 설정 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    setError(null);
  };

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">스케쥴관리시스템</CardTitle>
          <CardDescription>
            {step === "email" && "이메일을 입력하여 로그인하세요"}
            {step === "password" && `${username}님, 비밀번호를 입력하세요`}
            {step === "set-password" && "처음 로그인입니다. 비밀번호를 설정하세요"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>오류</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === "email" && (
            <form onSubmit={handleEmailCheck} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="이메일 주소를 입력하세요"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting} data-testid="button-continue">
                <LogIn className="mr-2 h-5 w-5" />
                {isSubmitting ? "확인 중..." : "계속"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                관리자가 미리 등록한 이메일로만 로그인할 수 있습니다.
              </p>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  data-testid="input-password"
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting} data-testid="button-login">
                <LogIn className="mr-2 h-5 w-5" />
                {isSubmitting ? "로그인 중..." : "로그인"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleBack} className="w-full" data-testid="button-back">
                <ArrowLeft className="mr-2 h-4 w-4" />
                이메일 다시 입력
              </Button>
            </form>
          )}

          {step === "set-password" && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">새 비밀번호</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="비밀번호를 입력하세요 (4자리 이상)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">비밀번호 확인</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  data-testid="input-confirm-password"
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting} data-testid="button-set-password">
                <KeyRound className="mr-2 h-5 w-5" />
                {isSubmitting ? "설정 중..." : "비밀번호 설정 및 로그인"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleBack} className="w-full" data-testid="button-back-set">
                <ArrowLeft className="mr-2 h-4 w-4" />
                이메일 다시 입력
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
