import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface WaitingRoomRequest {
    accountType: 'individual' | 'corporate';
    selectedPlan: 'pro' | 'business' | 'enterprise';
    companyName?: string;
    name: string;
    email: string;
    phone?: string;
    remarks?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: WaitingRoomRequest = await request.json();
        const { accountType, selectedPlan, companyName, name, email, phone, remarks } = body;

        // バリデーション
        if (!accountType || !selectedPlan || !name || !email) {
            return NextResponse.json(
                { success: false, error: '必須フィールドが不足しています' },
                { status: 400 }
            );
        }

        // プランのバリデーション
        const validPlans = ['pro', 'business', 'enterprise'];
        if (!validPlans.includes(selectedPlan)) {
            return NextResponse.json(
                { success: false, error: '有効なプランを選択してください' },
                { status: 400 }
            );
        }

        // 法人の場合は会社名必須
        if (accountType === 'corporate' && !companyName) {
            return NextResponse.json(
                { success: false, error: '法人の場合は会社名が必須です' },
                { status: 400 }
            );
        }

        // メールアドレスの簡易バリデーション
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { success: false, error: '有効なメールアドレスを入力してください' },
                { status: 400 }
            );
        }

        // 既存の登録チェック
        const existingEntry = await prisma.waitingRoomEntry.findFirst({
            where: { email }
        });

        if (existingEntry) {
            return NextResponse.json(
                { success: false, error: 'このメールアドレスは既に登録されています' },
                { status: 409 }
            );
        }

        // データベースに保存
        const entry = await prisma.waitingRoomEntry.create({
            data: {
                accountType,
                companyName: companyName || null,
                name,
                email,
                phone: phone || null,
                remarks: remarks || null,
                plan: selectedPlan,
                status: 'pending',
            }
        });

        console.log('=== Waiting Room 登録 ===');
        console.log('タイプ:', accountType === 'corporate' ? '法人' : '個人');
        console.log('希望プラン:', selectedPlan);
        if (companyName) console.log('会社名:', companyName);
        console.log('名前:', name);
        console.log('メール:', email);
        if (phone) console.log('電話:', phone);
        if (remarks) console.log('備考:', remarks);
        console.log('========================');

        return NextResponse.json({
            success: true,
            message: '順番待ちリストへの登録が完了しました',
            data: {
                id: entry.id,
                createdAt: entry.createdAt.toISOString(),
            }
        });

    } catch (error: any) {
        console.error('Waiting Room登録エラー:', error);
        return NextResponse.json(
            { success: false, error: error.message || '登録に失敗しました' },
            { status: 500 }
        );
    }
}
