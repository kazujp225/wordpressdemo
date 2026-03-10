export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Sharpのメモリ使用量を制限
    const sharp = (await import('sharp')).default;
    sharp.cache({ memory: 100 }); // キャッシュを100MBに制限
    sharp.cache({ files: 20 });   // ファイルキャッシュを20個に制限
    sharp.concurrency(1);         // 同時処理数を1に制限（メモリ節約）
    console.log('[Instrumentation] Sharp memory limits configured');
  }
}
