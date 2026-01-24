import { Resend } from 'resend';

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
