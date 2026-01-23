import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGoogleApiKeyForUser } from '@/lib/apiKeys';
import { logGeneration, createTimer } from '@/lib/generation-logger';
import sharp from 'sharp';

interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface OCRRequest {
    imageUrl?: string;
    imageBase64?: string;
    // Optional: single crop area (0-1 ratio) - legacy support
    cropArea?: CropArea;
    // Optional: multiple crop areas (0-1 ratio)
    cropAreas?: CropArea[];
}

export async function POST(request: NextRequest) {
    const startTime = createTimer();

    // ユーザー認証
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { imageUrl, imageBase64, cropArea, cropAreas }: OCRRequest = await request.json();

        // 複数範囲と単一範囲を統合
        const areas: CropArea[] = cropAreas || (cropArea ? [cropArea] : []);

        console.log(`[OCR] Received ${areas.length} crop areas:`, JSON.stringify(areas));

        const GOOGLE_API_KEY = await getGoogleApiKeyForUser(user.id);
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({
                error: 'Google API key is not configured. 設定画面でAPIキーを設定してください。'
            }, { status: 500 });
        }

        // 画像データ取得
        let imageBuffer: Buffer;

        if (imageBase64) {
            const base64Clean = imageBase64.replace(/^data:image\/\w+;base64,/, '');
            imageBuffer = Buffer.from(base64Clean, 'base64');
        } else if (imageUrl) {
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error('画像の取得に失敗しました');
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
        } else {
            return NextResponse.json({ error: '画像を指定してください' }, { status: 400 });
        }

        // 画像のメタデータを取得
        const metadata = await sharp(imageBuffer).metadata();
        if (!metadata.width || !metadata.height) {
            throw new Error('画像のサイズを取得できませんでした');
        }

        // クロップ処理（選択範囲がある場合）
        const processedBuffers: Buffer[] = [];

        if (areas.length > 0) {
            // 複数の選択範囲それぞれをクロップ
            for (let i = 0; i < areas.length; i++) {
                const area = areas[i];

                // 0-1の比率からピクセル座標に変換
                const cropX = Math.round(area.x * metadata.width);
                const cropY = Math.round(area.y * metadata.height);
                const cropWidth = Math.round(area.width * metadata.width);
                const cropHeight = Math.round(area.height * metadata.height);

                // 範囲チェック
                const safeX = Math.max(0, Math.min(cropX, metadata.width - 1));
                const safeY = Math.max(0, Math.min(cropY, metadata.height - 1));
                const safeWidth = Math.min(cropWidth, metadata.width - safeX);
                const safeHeight = Math.min(cropHeight, metadata.height - safeY);

                if (safeWidth < 10 || safeHeight < 10) {
                    console.log(`[OCR] Skipping area ${i + 1}: too small`);
                    continue;
                }

                console.log(`[OCR] Cropping area ${i + 1}: ${safeX},${safeY} ${safeWidth}x${safeHeight} from ${metadata.width}x${metadata.height}`);

                // クロップ実行
                const croppedBuffer = await sharp(imageBuffer)
                    .extract({
                        left: safeX,
                        top: safeY,
                        width: safeWidth,
                        height: safeHeight
                    })
                    .png()
                    .toBuffer();

                processedBuffers.push(croppedBuffer);
            }

            if (processedBuffers.length === 0) {
                throw new Error('有効な選択範囲がありません');
            }
        } else {
            // クロップなしの場合はそのまま
            processedBuffers.push(await sharp(imageBuffer).png().toBuffer());
        }

        // 複数画像の場合はGeminiに全部送る
        console.log(`[OCR] Processed ${processedBuffers.length} images for OCR`);

        const imageParts = processedBuffers.map((buf, idx) => ({
            inlineData: {
                mimeType: 'image/png',
                data: buf.toString('base64')
            }
        }));

        // OCR用プロンプト - 複数画像対応
        const imageCount = imageParts.length;
        const ocrPrompt = imageCount > 1
            ? `${imageCount}枚の画像内のテキストを全て読み取ってください。

【ルール】
1. 各画像を「【画像1】」「【画像2】」のように区切って出力してください
2. 日本語・英語・数字・記号を全て正確に読み取ってください
3. テキストの位置関係（上から下、左から右）を維持して出力してください
4. 改行は元の改行を維持してください
5. 文字化けや判読困難な文字があれば、最も近い推測を記載してください
6. テキストのみを出力し、説明文は不要です
7. 画像にテキストがない場合は「(テキストなし)」と出力してください

読み取ったテキスト:`
            : `この画像内のテキストを全て読み取ってください。

【ルール】
1. 日本語・英語・数字・記号を全て正確に読み取ってください
2. テキストの位置関係（上から下、左から右）を維持して出力してください
3. 改行は元の改行を維持してください
4. 文字化けや判読困難な文字があれば、最も近い推測を記載してください
5. テキストのみを出力し、説明文は不要です
6. 画像にテキストがない場合は「(テキストなし)」と出力してください

読み取ったテキスト:`;

        // Gemini Vision APIでOCR実行（複数画像対応）
        const parts: any[] = [...imageParts, { text: ocrPrompt }];

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: parts
                    }],
                    generationConfig: {
                        temperature: 0.1, // 低い温度でより正確に
                        maxOutputTokens: 4096 // 複数画像対応で増やす
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini Vision API error:', errorText);
            throw new Error(`OCR処理に失敗しました: ${response.status}`);
        }

        const data = await response.json();
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // ログ記録
        await logGeneration({
            userId: user.id,
            type: 'ocr',
            endpoint: '/api/ai/ocr',
            model: 'gemini-2.0-flash',
            inputPrompt: ocrPrompt,
            status: 'succeeded',
            startTime
        });

        return NextResponse.json({
            success: true,
            text: textContent.trim(),
            model: 'gemini-2.0-flash'
        });

    } catch (error: any) {
        console.error('OCR Error:', error);

        // ログ記録（エラー）
        await logGeneration({
            userId: user.id,
            type: 'ocr',
            endpoint: '/api/ai/ocr',
            model: 'gemini-2.0-flash',
            inputPrompt: 'OCR request',
            status: 'failed',
            errorMessage: error.message,
            startTime
        });

        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
