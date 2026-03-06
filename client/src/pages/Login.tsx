import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUser } from "@/contexts/UserContext";
import { AlertCircle, LogIn, KeyRound, ArrowLeft, ChevronDown, ChevronUp, Shield } from "lucide-react";
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

  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [optionalConsent, setOptionalConsent] = useState(false);
  const [showRequiredDetail, setShowRequiredDetail] = useState(false);
  const [showOptionalDetail, setShowOptionalDetail] = useState(false);

  const allConsent = privacyConsent && optionalConsent;

  const handleAllConsentChange = (checked: boolean) => {
    setPrivacyConsent(checked);
    setOptionalConsent(checked);
  };

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

    if (!privacyConsent) {
      setError("필수 개인정보 수집에 동의해야 합니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, privacyConsent, optionalConsent }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "비밀번호 설정에 실패했습니다.");
        return;
      }

      toast({ title: "설정 완료", description: "비밀번호가 설정되었습니다. 환영합니다!" });
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
    setPrivacyConsent(false);
    setOptionalConsent(false);
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
      <Card className={`w-full ${step === "set-password" ? "max-w-lg" : "max-w-md"}`}>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">AI 업무 알림 서비스</CardTitle>
          <CardDescription>
            {step === "email" && "이메일을 입력하여 로그인하세요"}
            {step === "password" && `${username}님, 비밀번호를 입력하세요`}
            {step === "set-password" && `${username}님, 처음 로그인입니다. 아래 정보를 설정해 주세요.`}
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
            <form onSubmit={handleSetPassword} className="space-y-5">
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

              <div className="border-t pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold">개인정보 수집 및 이용 동의서</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  본 기관(이하 '회사')은 「개인정보 보호법」 제15조 및 제22조 등 관련 법령에 의거하여, 귀하의 개인정보를 아래와 같이 수집 및 이용하고자 합니다. 내용을 자세히 읽으신 후 동의 여부를 결정해 주시기 바랍니다.
                </p>

                <div className="rounded-lg border bg-muted/30 p-3 mb-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="all-consent"
                      checked={allConsent}
                      onCheckedChange={(checked) => handleAllConsentChange(checked === true)}
                      data-testid="checkbox-all-consent"
                    />
                    <label htmlFor="all-consent" className="text-sm font-medium cursor-pointer leading-none">
                      개인정보 수집 및 이용에 전체 동의합니다.
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">필수 및 선택 항목 모두 포함</p>
                </div>

                <div className="space-y-2">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">필수</span>
                        <span className="text-sm">개인정보 수집 및 이용 동의</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 ml-0">
                      성명, 이메일, 부서, 직책 — 본인 확인 및 시스템 권한 관리를 위해 필요한 정보입니다.
                    </p>
                    <Collapsible open={showRequiredDetail} onOpenChange={setShowRequiredDetail}>
                      <CollapsibleTrigger asChild>
                        <Button variant="link" size="sm" className="p-0 h-auto text-xs text-blue-600 mt-1">
                          {showRequiredDetail ? (
                            <><ChevronUp className="h-3 w-3 mr-1" />접기</>
                          ) : (
                            <><ChevronDown className="h-3 w-3 mr-1" />전문 보기</>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-muted-foreground leading-relaxed space-y-2 max-h-48 overflow-y-auto">
                          <p className="font-semibold text-foreground">1. 필수적 수집·이용에 관한 사항</p>
                          <p>회사는 시스템 이용 및 서비스 제공을 위해 아래와 같은 최소한의 개인정보를 수집합니다.</p>
                          <p>■ 수집 항목: 성명, 이메일 주소, 소속 부서, 직책</p>
                          <div>
                            <p>■ 수집 및 이용 목적:</p>
                            <p className="ml-3">· 서비스 이용에 따른 본인 식별 및 인증</p>
                            <p className="ml-3">· 시스템 접근 권한 관리 및 부정 이용 방지</p>
                            <p className="ml-3">· 업무 관련 공지사항 전달 및 고충 처리 등 소통 창구 확보</p>
                          </div>
                          <p>■ 보유 및 이용 기간: 서비스 탈퇴 시 또는 퇴사 처리 시까지 보관합니다. 단, 관계 법령(예: 상법, 전자상거래법 등)의 규정에 따라 보존할 필요가 있는 경우 해당 법령에서 정한 기간 동안 안전하게 보관합니다.</p>
                          <p>■ 동의 거부 권리 및 불이익: 귀하는 필수 항목 수집에 대한 동의를 거부할 수 있습니다. 다만, 필수 항목은 시스템 이용을 위한 최소한의 정보이므로, 동의하지 않으실 경우 계정 생성 및 시스템 로그인이 불가합니다.</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                    <div className="flex items-center space-x-2 mt-2 pt-2 border-t">
                      <Checkbox
                        id="privacy-consent"
                        checked={privacyConsent}
                        onCheckedChange={(checked) => setPrivacyConsent(checked === true)}
                        data-testid="checkbox-privacy-consent"
                      />
                      <label htmlFor="privacy-consent" className="text-sm cursor-pointer leading-none">
                        동의함
                      </label>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">선택</span>
                        <span className="text-sm">개인정보 수집 및 이용 동의</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 ml-0">
                      전화번호 — 비상 연락 및 알림 서비스 수신을 위한 정보입니다.
                    </p>
                    <Collapsible open={showOptionalDetail} onOpenChange={setShowOptionalDetail}>
                      <CollapsibleTrigger asChild>
                        <Button variant="link" size="sm" className="p-0 h-auto text-xs text-blue-600 mt-1">
                          {showOptionalDetail ? (
                            <><ChevronUp className="h-3 w-3 mr-1" />접기</>
                          ) : (
                            <><ChevronDown className="h-3 w-3 mr-1" />전문 보기</>
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-muted-foreground leading-relaxed space-y-2 max-h-48 overflow-y-auto">
                          <p className="font-semibold text-foreground">2. 선택적 수집·이용에 관한 사항</p>
                          <p>회사는 업무 편의 제공을 위해 아래와 같이 추가 정보를 수집할 수 있습니다.</p>
                          <p>■ 수집 항목: 휴대전화 번호</p>
                          <p>■ 수집 및 이용 목적: 비상 연락망 확보 및 업무 관련 알림 서비스(SMS, 알림톡 등) 제공</p>
                          <p>■ 보유 및 이용 기간: 동의 철회 시 또는 서비스 탈퇴 시까지 보관합니다.</p>
                          <p>■ 동의 거부 권리 및 불이익: 귀하는 선택 항목 수집에 대한 동의를 거부할 권리가 있습니다. 동의하지 않더라도 시스템 이용은 가능하나, 업무 관련 긴급 알림 수신 등 일부 부가 기능 이용이 제한될 수 있습니다.</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                    <div className="flex items-center space-x-2 mt-2 pt-2 border-t">
                      <Checkbox
                        id="optional-consent"
                        checked={optionalConsent}
                        onCheckedChange={(checked) => setOptionalConsent(checked === true)}
                        data-testid="checkbox-optional-consent"
                      />
                      <label htmlFor="optional-consent" className="text-sm cursor-pointer leading-none">
                        동의함
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting || !privacyConsent}
                data-testid="button-set-password"
              >
                <KeyRound className="mr-2 h-5 w-5" />
                {isSubmitting ? "설정 중..." : "시작하기"}
              </Button>
              {!privacyConsent && (
                <p className="text-xs text-muted-foreground text-center">
                  필수 개인정보 수집에 동의해야 서비스를 시작할 수 있습니다.
                </p>
              )}
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
