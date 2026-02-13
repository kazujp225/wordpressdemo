import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// POST: パスワードリセット依頼（認証不要）
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email } = body;

        if (!email || !email.includes('@')) {
            return Response.json({ error: 'メールアドレスを入力してください' }, { status: 400 });
        }

        // お問い合わせとして保存（userIdはメールアドレスで代用）
        await prisma.contactInquiry.create({
            data: {
                userId: email,
                email: email,
                subject: 'パスワードリセット依頼',
                body: `${email} のパスワードリセットを依頼します。\n\n管理者ページ（ユーザー管理）からパスワードを再設定してください。`,
                status: 'open',
            },
        });

        return Response.json({ success: true });
    } catch (error: any) {
        console.error('Failed to create password reset request:', error);
        return Response.json({ error: 'リクエストの送信に失敗しました' }, { status: 500 });
    }
}
