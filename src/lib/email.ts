import { Resend } from 'resend';

// システムメール用の設定
const SYSTEM_FROM_EMAIL = process.env.SYSTEM_FROM_EMAIL || 'noreply@lpbuilder.app';
const SYSTEM_RESEND_API_KEY = process.env.RESEND_API_KEY;

interface FormField {
  fieldName: string;
  fieldLabel: string;
  value: string;
}

interface SendFormNotificationParams {
  apiKey: string;
  to: string;
  fromDomain?: string | null;
  pageTitle: string;
  pageSlug: string;
  formTitle: string;
  fields: FormField[];
  senderEmail?: string | null;
  senderName?: string | null;
}

/**
 * ウェルカムメール送信（新規登録完了時）
 * パスワード設定リンクを送信（平文パスワードは送信しない）
 */
export async function sendWelcomeEmail({
  to,
  planName,
  passwordSetupUrl,
}: {
  to: string;
  planName: string;
  passwordSetupUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!SYSTEM_RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not configured');
    return { success: false, error: 'メール設定が構成されていません' };
  }

  try {
    const resend = new Resend(SYSTEM_RESEND_API_KEY);

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <div style="display:inline-block;background:#000;color:#fff;padding:12px 20px;border-radius:8px;font-size:20px;font-weight:bold;">
            LP Builder
          </div>
        </div>

        <h1 style="font-size:24px;font-weight:bold;color:#111827;margin-bottom:16px;text-align:center;">
          ご登録ありがとうございます
        </h1>

        <p style="color:#6b7280;margin-bottom:24px;text-align:center;">
          ${escapeHtml(planName)}プランへのご登録が完了しました。<br>
          下のボタンをクリックしてパスワードを設定してください。
        </p>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:24px;margin-bottom:24px;">
          <table style="width:100%;">
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px;">ログインID（メールアドレス）</td>
            </tr>
            <tr>
              <td style="padding:0;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(to)}</td>
            </tr>
          </table>
        </div>

        <div style="text-align:center;margin-bottom:24px;">
          <a href="${escapeHtml(passwordSetupUrl)}"
             style="display:inline-block;background:#000;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
            パスワードを設定する
          </a>
        </div>

        <p style="color:#9ca3af;font-size:12px;text-align:center;margin-bottom:24px;">
          このリンクは24時間有効です。<br>
          有効期限が切れた場合は、ログイン画面から「パスワードを忘れた方」をご利用ください。
        </p>

        <div style="border-top:1px solid #e5e7eb;padding-top:24px;margin-top:24px;">
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
            このメールは自動送信されています。<br>
            ご不明な点がございましたら、サポートまでお問い合わせください。
          </p>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: SYSTEM_FROM_EMAIL,
      to,
      subject: '【LP Builder】ご登録完了 - パスワード設定のお願い',
      html,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Welcome email send error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendFormNotification({
  apiKey,
  to,
  fromDomain,
  pageTitle,
  pageSlug,
  formTitle,
  fields,
  senderEmail,
  senderName,
}: SendFormNotificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = new Resend(apiKey);

    const from = fromDomain
      ? `notifications@${fromDomain}`
      : 'onboarding@resend.dev';

    const fieldsHtml = fields
      .map(
        (f) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#374151;width:30%;vertical-align:top;">${escapeHtml(f.fieldLabel)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#1f2937;">${escapeHtml(f.value)}</td>
          </tr>`
      )
      .join('');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:24px;margin-bottom:16px;">
          <h2 style="margin:0 0 4px;font-size:18px;color:#111827;">${escapeHtml(formTitle)}</h2>
          <p style="margin:0;font-size:13px;color:#6b7280;">
            ページ: ${escapeHtml(pageTitle)} (/${escapeHtml(pageSlug)})
          </p>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          ${fieldsHtml}
        </table>
        <p style="margin-top:16px;font-size:12px;color:#9ca3af;">
          このメールはフォーム送信の自動通知です。
        </p>
      </div>
    `;

    const subject = `[${pageTitle}] ${formTitle} - 新しいお問い合わせ`;

    await resend.emails.send({
      from,
      to,
      subject,
      html,
      replyTo: senderEmail || undefined,
    });

    return { success: true };
  } catch (error: any) {
    console.error('Email send error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
