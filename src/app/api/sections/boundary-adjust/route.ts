import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db';
import sharp from 'sharp';
import { supabase as supabaseAdmin } from '@/lib/supabase';

/**
 * 境界調整API
 * 2つのセクション間の境界をピクセル単位で調整する
 *
 * offsetPixels > 0: 境界を下に移動（上セクションを下に伸ばす / 下セクションの上をカット）
 * offsetPixels < 0: 境界を上に移動（上セクションの下をカット / 下セクションを上に伸ばす）
 */

const log = {
    info: (msg: string) => console.log(`\x1b[36m[BOUNDARY-ADJUST INFO]\x1b[0m ${msg}`),
    success: (msg: string) => console.log(`\x1b[32m[BOUNDARY-ADJUST SUCCESS]\x1b[0m ✓ ${msg}`),
    error: (msg: string) => console.log(`\x1b[31m[BOUNDARY-ADJUST ERROR]\x1b[0m ✗ ${msg}`),
};

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { upperSectionId, lowerSectionId, offsetPixels } = body;

        if (!upperSectionId || !lowerSectionId) {
            return NextResponse.json({ error: 'セクションIDが必要です' }, { status: 400 });
        }

        if (typeof offsetPixels !== 'number' || offsetPixels === 0) {
            return NextResponse.json({ error: '有効なオフセット値が必要です' }, { status: 400 });
        }

        // IDを数値に変換
        const upperIdNum = parseInt(String(upperSectionId), 10);
        const lowerIdNum = parseInt(String(lowerSectionId), 10);

        if (isNaN(upperIdNum) || isNaN(lowerIdNum)) {
            return NextResponse.json({ error: '無効なセクションIDです' }, { status: 400 });
        }

        log.info(`Adjusting boundary: upper=${upperIdNum}, lower=${lowerIdNum}, offset=${offsetPixels}px`);

        // セクション情報を取得
        const [upperSection, lowerSection] = await Promise.all([
            prisma.pageSection.findUnique({
                where: { id: upperIdNum },
                include: { image: true }
            }),
            prisma.pageSection.findUnique({
                where: { id: lowerIdNum },
                include: { image: true }
            })
        ]);

        if (!upperSection?.image || !lowerSection?.image) {
            log.error(`Section images not found: upper=${!!upperSection?.image}, lower=${!!lowerSection?.image}`);
            return NextResponse.json({ error: 'セクション画像が見つかりません' }, { status: 404 });
        }

        // filePath is already the full public URL
        const upperUrl = upperSection.image.filePath;
        const lowerUrl = lowerSection.image.filePath;

        log.info(`Upper image URL: ${upperUrl}`);
        log.info(`Lower image URL: ${lowerUrl}`);
        log.info(`Fetching images from Supabase...`);

        const [upperImageResponse, lowerImageResponse] = await Promise.all([
            fetch(upperUrl),
            fetch(lowerUrl)
        ]);

        if (!upperImageResponse.ok || !lowerImageResponse.ok) {
            log.error(`Image fetch failed: upper=${upperImageResponse.status}, lower=${lowerImageResponse.status}`);
            return NextResponse.json({ error: '画像の取得に失敗しました' }, { status: 500 });
        }

        log.info(`Images fetched successfully`);

        const upperBuffer = Buffer.from(await upperImageResponse.arrayBuffer());
        const lowerBuffer = Buffer.from(await lowerImageResponse.arrayBuffer());

        // 画像のメタデータを取得
        const [upperMeta, lowerMeta] = await Promise.all([
            sharp(upperBuffer).metadata(),
            sharp(lowerBuffer).metadata()
        ]);

        if (!upperMeta.width || !upperMeta.height || !lowerMeta.width || !lowerMeta.height) {
            return NextResponse.json({ error: '画像メタデータの取得に失敗しました' }, { status: 500 });
        }

        log.info(`Upper image: ${upperMeta.width}x${upperMeta.height}, Lower image: ${lowerMeta.width}x${lowerMeta.height}`);

        // 実際のピクセル調整量を計算（表示サイズと実際の画像サイズの比率を考慮）
        // プレビュー幅が約600px、実際の画像幅が例えば1280pxなら、offsetを約2倍にする
        const displayWidth = 600; // プレビュー表示幅の概算
        const scaleFactor = upperMeta.width / displayWidth;
        const actualOffset = Math.round(offsetPixels * scaleFactor);

        log.info(`Scale factor: ${scaleFactor}, Actual offset: ${actualOffset}px`);

        let newUpperBuffer: Buffer;
        let newLowerBuffer: Buffer;
        let newUpperHeight: number;
        let newLowerHeight: number;

        if (actualOffset > 0) {
            // 境界を下に移動: 上セクションはそのまま、下セクションの上部をカット
            const cutAmount = Math.min(actualOffset, lowerMeta.height - 100); // 最低100px残す

            newUpperBuffer = upperBuffer;
            newUpperHeight = upperMeta.height;

            // 下セクションの上部をカット
            newLowerBuffer = await sharp(lowerBuffer)
                .extract({
                    left: 0,
                    top: cutAmount,
                    width: lowerMeta.width,
                    height: lowerMeta.height - cutAmount
                })
                .toBuffer();
            newLowerHeight = lowerMeta.height - cutAmount;

            log.info(`Cut ${cutAmount}px from top of lower section`);
        } else {
            // 境界を上に移動: 上セクションの下部をカット、下セクションはそのまま
            const cutAmount = Math.min(Math.abs(actualOffset), upperMeta.height - 100); // 最低100px残す

            // 上セクションの下部をカット
            newUpperBuffer = await sharp(upperBuffer)
                .extract({
                    left: 0,
                    top: 0,
                    width: upperMeta.width,
                    height: upperMeta.height - cutAmount
                })
                .toBuffer();
            newUpperHeight = upperMeta.height - cutAmount;

            newLowerBuffer = lowerBuffer;
            newLowerHeight = lowerMeta.height;

            log.info(`Cut ${cutAmount}px from bottom of upper section`);
        }

        // 新しい画像をSupabaseにアップロード
        const timestamp = Date.now();
        const upperFilename = `${user.id}/boundary-adj-upper-${timestamp}.png`;
        const lowerFilename = `${user.id}/boundary-adj-lower-${timestamp}.png`;

        const [upperUpload, lowerUpload] = await Promise.all([
            supabaseAdmin.storage.from('images').upload(upperFilename, newUpperBuffer, {
                contentType: 'image/png',
                upsert: true
            }),
            supabaseAdmin.storage.from('images').upload(lowerFilename, newLowerBuffer, {
                contentType: 'image/png',
                upsert: true
            })
        ]);

        if (upperUpload.error || lowerUpload.error) {
            log.error(`Upload failed: ${upperUpload.error?.message || lowerUpload.error?.message}`);
            return NextResponse.json({ error: '画像のアップロードに失敗しました' }, { status: 500 });
        }

        // Get public URLs
        const upperPublicUrl = supabaseAdmin.storage.from('images').getPublicUrl(upperFilename).data.publicUrl;
        const lowerPublicUrl = supabaseAdmin.storage.from('images').getPublicUrl(lowerFilename).data.publicUrl;

        log.info(`Uploaded upper: ${upperPublicUrl}`);
        log.info(`Uploaded lower: ${lowerPublicUrl}`);

        // MediaImageレコードを作成
        const [newUpperImage, newLowerImage] = await Promise.all([
            prisma.mediaImage.create({
                data: {
                    userId: user.id,
                    filePath: upperPublicUrl,
                    width: upperMeta.width,
                    height: newUpperHeight,
                    mime: 'image/png',
                    sourceType: 'boundary-adjust'
                }
            }),
            prisma.mediaImage.create({
                data: {
                    userId: user.id,
                    filePath: lowerPublicUrl,
                    width: lowerMeta.width,
                    height: newLowerHeight,
                    mime: 'image/png',
                    sourceType: 'boundary-adjust'
                }
            })
        ]);

        // セクションの画像参照を更新
        await Promise.all([
            prisma.pageSection.update({
                where: { id: upperIdNum },
                data: { imageId: newUpperImage.id }
            }),
            prisma.pageSection.update({
                where: { id: lowerIdNum },
                data: { imageId: newLowerImage.id }
            })
        ]);

        log.success('Boundary adjusted successfully');

        return NextResponse.json({
            success: true,
            upperImage: {
                id: newUpperImage.id,
                filePath: newUpperImage.filePath,
                width: newUpperImage.width,
                height: newUpperImage.height
            },
            lowerImage: {
                id: newLowerImage.id,
                filePath: newLowerImage.filePath,
                width: newLowerImage.width,
                height: newLowerImage.height
            }
        });

    } catch (error: any) {
        log.error(`Failed: ${error.message}`);
        log.error(`Stack: ${error.stack}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
