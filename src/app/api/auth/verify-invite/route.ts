import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// 招待パスワード（環境変数から取得、必須）
const INVITE_PASSWORD = process.env.INVITE_PASSWORD;

if (!INVITE_PASSWORD) {
    console.error('INVITE_PASSWORD environment variable is required');
}

/**
 * タイミングセーフな文字列比較（タイミング攻撃防止）
 */
function timingSafeCompare(a: string, b: string): boolean {
    // 両方をSHA-256でハッシュし固定長にすることでタイミングリークを防ぐ
    const hashA = crypto.createHash('sha256').update(a).digest();
    const hashB = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
}

export async function POST(request: NextRequest) {
    try {
        const { password } = await request.json();

        if (!password || typeof password !== 'string') {
            return NextResponse.json({ valid: false, error: '招待パスワードを入力してください' }, { status: 400 });
        }

        if (!INVITE_PASSWORD) {
            console.error('INVITE_PASSWORD is not configured');
            return NextResponse.json({ valid: false, error: 'サーバー設定エラー' }, { status: 500 });
        }

        // タイミングセーフ比較（大文字小文字を区別）
        const isValid = timingSafeCompare(password, INVITE_PASSWORD);

        if (!isValid) {
            return NextResponse.json({ valid: false, error: '招待パスワードが正しくありません' }, { status: 401 });
        }

        return NextResponse.json({ valid: true });
    } catch (error: any) {
        console.error('Invite password verification error:', error);
        return NextResponse.json({ valid: false, error: 'サーバーエラー' }, { status: 500 });
    }
}
