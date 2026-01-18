export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function redirectToLogin(toast?: (options: { title: string; description: string; variant: string }) => void) {
  if (toast) {
    toast({
      title: "인증 오류",
      description: "로그아웃되었습니다. 다시 로그인해주세요.",
      variant: "destructive",
    });
  }
  setTimeout(() => {
    window.location.href = "/";
  }, 500);
}
