import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { sendFormNotification } from '@/lib/email';
import { sanitizeHtml, checkBanStatus } from '@/lib/security';

interface FormSubmissionRequest {
    pageSlug: string;
    formTitle?: string;
    formFields: Array<{
        fieldName: string;
        fieldLabel: string;
        value: string;
    }>;
    // ハニーポットフィールド（スパムボット検出用）
    _hp_field?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: FormSubmissionRequest = await request.json();
        const { pageSlug, formTitle, formFields, _hp_field } = body;

        // ハニーポットチェック（ボットはhidden fieldに値を入力する）
        if (_hp_field) {
            // スパムボットと判断、成功レスポンスを返す（攻撃者に検出を知らせない）
            return NextResponse.json({ success: true, message: '送信が完了しました' });
        }

        if (!pageSlug || !formFields || formFields.length === 0) {
            return NextResponse.json(
                { success: false, error: '必須フィールドが不足しています' },
                { status: 400 }
            );
        }

        // フィールド数の上限チェック（DoS防止）
        if (formFields.length > 50) {
            return NextResponse.json(
                { success: false, error: 'フィールド数が多すぎます（上限50）' },
                { status: 400 }
            );
        }

        // 各フィールドの値をサニタイズ（XSS防止）
        const sanitizedFields = formFields.map((f: { fieldName: string; fieldLabel: string; value: string }) => ({
            fieldName: sanitizeHtml(String(f.fieldName || '').slice(0, 200)),
            fieldLabel: sanitizeHtml(String(f.fieldLabel || '').slice(0, 200)),
            value: sanitizeHtml(String(f.value || '').slice(0, 5000)),
        }));

        // ページの存在確認
        const page = await prisma.page.findFirst({
            where: {
                OR: [
                    { slug: pageSlug },
                    { id: isNaN(parseInt(pageSlug)) ? -1 : parseInt(pageSlug) }
                ]
            },
            select: { id: true, title: true, userId: true }
        });

        if (!page) {
            return NextResponse.json(
                { success: false, error: 'ページが見つかりません' },
                { status: 404 }
            );
        }

        // ページ所有者のBANチェック（BAN済みユーザーのページへの送信を防止）
        if (page.userId) {
            const banResponse = await checkBanStatus(page.userId);
            if (banResponse) return banResponse;
        }

        // メールフィールドを抽出（サニタイズ済みデータから）
        const emailField = sanitizedFields.find(
            (f: { fieldName: string; fieldLabel: string; value: string }) => f.fieldName === 'email' || f.fieldLabel.toLowerCase().includes('email') || f.fieldLabel.includes('メール')
        );
        const nameField = sanitizedFields.find(
            (f: { fieldName: string; fieldLabel: string; value: string }) => f.fieldName === 'name' || f.fieldLabel.toLowerCase().includes('name') || f.fieldLabel.includes('名前') || f.fieldLabel.includes('お名前')
        );

        // メールアドレスのバリデーション（RFC 5321準拠の基本チェック）
        if (emailField?.value) {
            const email = emailField.value;
            const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
            if (!emailRegex.test(email) || email.length > 254) {
                return NextResponse.json(
                    { success: false, error: '有効なメールアドレスを入力してください' },
                    { status: 400 }
                );
            }
        }

        // DBに保存（サニタイズ済み）
        const submission = await prisma.formSubmission.create({
            data: {
                pageId: page.id,
                pageSlug: sanitizeHtml(pageSlug),
                formTitle: sanitizeHtml(formTitle || 'お問い合わせ'),
                fields: JSON.stringify(sanitizedFields),
                senderEmail: emailField?.value || null,
                senderName: nameField?.value || null,
            },
        });

        // メール通知（非ブロッキング）
        if (page.userId) {
            try {
                const userSettings = await prisma.userSettings.findUnique({
                    where: { userId: page.userId },
                    select: { resendApiKey: true, notificationEmail: true, resendFromDomain: true },
                });

                if (userSettings?.resendApiKey && userSettings?.notificationEmail) {
                    const apiKey = decrypt(userSettings.resendApiKey);
                    const result = await sendFormNotification({
                        apiKey,
                        to: userSettings.notificationEmail,
                        fromDomain: userSettings.resendFromDomain,
                        pageTitle: page.title,
                        pageSlug,
                        formTitle: sanitizeHtml(formTitle || 'お問い合わせ'),
                        fields: sanitizedFields,
                        senderEmail: emailField?.value,
                        senderName: nameField?.value,
                    });

                    if (result.success) {
                        await prisma.formSubmission.update({
                            where: { id: submission.id },
                            data: { notifiedAt: new Date() },
                        });
                    }
                }
            } catch (emailError) {
                console.error('Email notification failed (non-blocking):', emailError);
            }
        }

        return NextResponse.json({
            success: true,
            message: '送信が完了しました',
        });

    } catch (error: any) {
        console.error('フォーム送信エラー:', error);
        return NextResponse.json(
            { success: false, error: '送信に失敗しました' },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        success: true,
        message: 'フォーム送信履歴機能は準備中です',
        data: []
    });
}
