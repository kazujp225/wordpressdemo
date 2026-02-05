-- AlterTable: GenerationRun に requestId と updatedAt を追加
ALTER TABLE "GenerationRun" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
ALTER TABLE "GenerationRun" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- デフォルトのstatusを "processing" に変更（新規レコード用）
-- 既存レコードは "succeeded" のまま
ALTER TABLE "GenerationRun" ALTER COLUMN "status" SET DEFAULT 'processing';

-- CreateIndex: requestId にユニークインデックスを追加
CREATE UNIQUE INDEX IF NOT EXISTS "GenerationRun_requestId_key" ON "GenerationRun"("requestId");

-- CreateIndex: requestId に通常インデックスを追加（検索用）
CREATE INDEX IF NOT EXISTS "GenerationRun_requestId_idx" ON "GenerationRun"("requestId");
