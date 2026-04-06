import { getUncachableGmailClient } from './gmailClient';

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

function createRawEmail(to: string, subject: string, body: string, isHtml: boolean): string {
  const fromName = 'AI 업무 알림 서비스';
  const boundary = 'boundary_' + Date.now();

  const headers = [
    `From: "${fromName}" <me>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
  ].join('\r\n');

  const encodedBody = Buffer.from(body).toString('base64');
  const raw = `${headers}\r\n\r\n${encodedBody}`;

  return Buffer.from(raw).toString('base64url');
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const gmail = await getUncachableGmailClient();
    const raw = createRawEmail(options.to, options.subject, options.body, options.isHtml || false);

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return {
      success: true,
      messageId: result.data.id || undefined,
    };
  } catch (error: any) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

export async function sendDailyDigestEmail(
  user: { username: string; email: string | null },
  digest: {
    inspectionItems: { assetName: string; dueDate: string; status: 'upcoming' | 'overdue'; daysLeft?: number; daysOverdue?: number; staffName: string }[];
    todayTasks: { title: string; time: string; description?: string; isShared: boolean; ownerName?: string }[];
    tomorrowTasks: { title: string; time: string; description?: string; isShared: boolean; ownerName?: string }[];
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const dateStr = nowKST.toLocaleDateString('en-CA');
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][nowKST.getDay()];
  const subject = `[오늘의 알림 요약] ${dateStr}(${dayOfWeek})`;

  const inspectionSection = digest.inspectionItems.length > 0 ? `
    <div style="margin-bottom: 28px;">
      <h3 style="color: #1d4ed8; margin: 0 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #dbeafe; font-size: 15px;">
        📋 점검 알림 (${digest.inspectionItems.length}건)
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #eff6ff;">
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">대상명</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">점검 예정일</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">상태</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #bfdbfe;">담당자</th>
          </tr>
        </thead>
        <tbody>
          ${digest.inspectionItems.map(item => {
            const statusLabel = item.status === 'overdue'
              ? `<span style="color:#dc2626;font-weight:600;">⚠ ${item.daysOverdue}일 초과</span>`
              : `<span style="color:#2563eb;">D-${item.daysLeft}일</span>`;
            const rowBg = item.status === 'overdue' ? '#fff1f2' : '#ffffff';
            return `
              <tr style="background:${rowBg};">
                <td style="padding: 7px 10px; border: 1px solid #e5e7eb;">${item.assetName}</td>
                <td style="padding: 7px 10px; border: 1px solid #e5e7eb;">${item.dueDate}</td>
                <td style="padding: 7px 10px; border: 1px solid #e5e7eb;">${statusLabel}</td>
                <td style="padding: 7px 10px; border: 1px solid #e5e7eb;">${item.staffName}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : '';

  const renderTaskRows = (tasks: typeof digest.todayTasks) =>
    tasks.map(t => `
      <tr>
        <td style="padding: 7px 10px; border: 1px solid #e5e7eb;">${t.time}</td>
        <td style="padding: 7px 10px; border: 1px solid #e5e7eb;">
          ${t.title}${t.isShared ? ` <span style="font-size:11px;color:#6b7280;">(${t.ownerName}님 일정)</span>` : ''}
        </td>
        <td style="padding: 7px 10px; border: 1px solid #e5e7eb; color:#6b7280;">${t.description || '-'}</td>
      </tr>`).join('');

  const todaySection = digest.todayTasks.length > 0 ? `
    <div style="margin-bottom: 28px;">
      <h3 style="color: #059669; margin: 0 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #d1fae5; font-size: 15px;">
        📅 오늘 일정 (${digest.todayTasks.length}건)
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #ecfdf5;">
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0; width: 80px;">시간</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">일정 제목</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #a7f3d0;">내용</th>
          </tr>
        </thead>
        <tbody>${renderTaskRows(digest.todayTasks)}</tbody>
      </table>
    </div>` : '';

  const tomorrowSection = digest.tomorrowTasks.length > 0 ? `
    <div style="margin-bottom: 28px;">
      <h3 style="color: #7c3aed; margin: 0 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #ede9fe; font-size: 15px;">
        📅 내일 예정 (${digest.tomorrowTasks.length}건)
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #f5f3ff;">
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #c4b5fd; width: 80px;">시간</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #c4b5fd;">일정 제목</th>
            <th style="padding: 8px 10px; text-align: left; border: 1px solid #c4b5fd;">내용</th>
          </tr>
        </thead>
        <tbody>${renderTaskRows(digest.tomorrowTasks)}</tbody>
      </table>
    </div>` : '';

  const body = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; line-height: 1.6; color: #111827; margin: 0; padding: 0; background: #f9fafb;">
  <div style="max-width: 640px; margin: 24px auto; background: #ffffff; border-radius: 12px; box-shadow: 0 1px 6px rgba(0,0,0,0.08); overflow: hidden;">
    <div style="background: #1e40af; color: #ffffff; padding: 20px 28px;">
      <p style="margin: 0; font-size: 13px; opacity: 0.85;">AI 업무 알림 서비스</p>
      <h1 style="margin: 4px 0 0 0; font-size: 20px; font-weight: 700;">오늘의 알림 요약</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.85;">${dateStr}(${dayOfWeek}) · ${user.username}님</p>
    </div>
    <div style="padding: 28px;">
      ${inspectionSection}
      ${todaySection}
      ${tomorrowSection}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 11px; color: #9ca3af; margin: 0;">이 메일은 AI 업무 알림 서비스에서 자동 발송되었습니다. · 발송 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({ to: user.email!, subject, body, isHtml: true });
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
      <p style="margin: 5px 0;"><strong>발송 방식:</strong> Gmail API</p>
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
