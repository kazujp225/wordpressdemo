import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { sendFormNotification } from '@/lib/email';

interface FormSubmissionRequest {
    pageSlug: string;
    formTitle?: string;
    formFields: Array<{
        fieldName: string;
        fieldLabel: string;
        value: string;
    }>;
}

export async function POST(request: NextRequest) {
    try {
        const body: FormSubmissionRequest = await request.json();
        const { pageSlug, formTitle, formFields } = body;

        if (!pageSlug || !formFields || formFields.length === 0) {
            return NextResponse.json(
                { success: false, error: '必須フィールドが不足しています' },
                { status: 400 }
            );
        }

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

        // メールフィールドを抽出
        const emailField = formFields.find(
            (f) => f.fieldName === 'email' || f.fieldLabel.toLowerCase().includes('email') || f.fieldLabel.includes('メール')
        );
        const nameField = formFields.find(
            (f) => f.fieldName === 'name' || f.fieldLabel.toLowerCase().includes('name') || f.fieldLabel.includes('名前') || f.fieldLabel.includes('お名前')
        );

        // DBに保存
        const submission = await prisma.formSubmission.create({
            data: {
                pageId: page.id,
                pageSlug,
                formTitle: formTitle || 'お問い合わせ',
                fields: JSON.stringify(formFields),
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
                        formTitle: formTitle || 'お問い合わせ',
                        fields: formFields,
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
