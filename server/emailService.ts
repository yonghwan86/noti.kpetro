import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.kpetro.or.kr',
  port: parseInt(process.env.SMTP_PORT || '25'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'ax',
    pass: process.env.SMTP_PASSWORD || '',
  },
  tls: {
    rejectUnauthorized: false,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const fromName = process.env.SMTP_FROM_NAME || 'AI 업무 알림 서비스';
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'ax@kpetro.or.kr';

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      ...(options.isHtml ? { html: options.body } : { text: options.body }),
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

export async function sendInspectionReminder(
  to: string,
  assetName: string,
  dueDate: string,
  staffName: string,
  teamName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const subject = `[스케줄 관리시스템] ${assetName} 점검 예정 알림`;
  const body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #2563eb;">점검 예정 알림</h2>
    <p>${staffName}님, 안녕하세요.</p>
    <p>다음 대상의 점검 예정일이 다가왔습니다.</p>
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>담당팀:</strong> ${teamName}</p>
      <p style="margin: 5px 0;"><strong>대상:</strong> ${assetName}</p>
      <p style="margin: 5px 0;"><strong>점검 예정일:</strong> ${dueDate}</p>
    </div>
    <p>예정일 전에 점검을 완료해 주세요.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 12px; color: #6b7280;">이 메일은 스케줄 관리시스템에서 자동 발송되었습니다.</p>
  </div>
</body>
</html>
`;

  return sendEmail({
    to,
    subject,
    body,
    isHtml: true
  });
}

export async function sendOverdueAlert(
  to: string,
  assetName: string,
  dueDate: string,
  staffName: string,
  teamName: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const subject = `[스케줄 관리시스템] ${assetName} 점검 지연 경고`;
  const body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #dc2626;">점검 지연 경고</h2>
    <p>${staffName}님, 안녕하세요.</p>
    <p>다음 대상의 점검 예정일이 <strong style="color: #dc2626;">지연</strong>되었습니다. 즉시 점검을 완료해 주세요.</p>
    <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fca5a5;">
      <p style="margin: 5px 0;"><strong>담당팀:</strong> ${teamName}</p>
      <p style="margin: 5px 0;"><strong>대상:</strong> ${assetName}</p>
      <p style="margin: 5px 0;"><strong>점검 예정일:</strong> ${dueDate}</p>
      <p style="margin: 5px 0; color: #dc2626;"><strong>상태: 지연</strong></p>
    </div>
    <p>점검이 지연되면 안전 및 규정 준수에 영향을 줄 수 있습니다. 빠른 시일 내에 점검을 완료해 주시기 바랍니다.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 12px; color: #6b7280;">이 메일은 스케줄 관리시스템에서 자동 발송되었습니다.</p>
  </div>
</body>
</html>
`;

  return sendEmail({
    to,
    subject,
    body,
    isHtml: true
  });
}

export async function sendTestEmail(to: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const subject = '[스케줄 관리시스템] 테스트 이메일';
  const body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #22c55e;">이메일 테스트 성공!</h2>
    <p>스케줄 관리시스템의 이메일 발송 기능이 정상적으로 작동합니다.</p>
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #22c55e;">
      <p style="margin: 5px 0;">이 메일이 도착했다면 이메일 설정이 완료된 것입니다.</p>
      <p style="margin: 5px 0;"><strong>발신:</strong> ${process.env.SMTP_FROM_EMAIL || 'ax@kpetro.or.kr'}</p>
    </div>
    <p>이제 다음 기능들을 사용할 수 있습니다:</p>
    <ul>
      <li>점검 예정일 알림</li>
      <li>점검 지연 경고</li>
      <li>장비 등록 알림</li>
    </ul>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 12px; color: #6b7280;">발송 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
  </div>
</body>
</html>
`;

  return sendEmail({
    to,
    subject,
    body,
    isHtml: true
  });
}
