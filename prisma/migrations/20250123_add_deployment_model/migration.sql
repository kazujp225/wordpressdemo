-- CreateTable
CREATE TABLE "Deployment" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" INTEGER,
    "serviceName" TEXT NOT NULL,
    "renderServiceId" TEXT,
    "siteUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "generatedHtml" TEXT,
    "templateType" TEXT,
    "prompt" TEXT,
    "githubRepoUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deployment_userId_idx" ON "Deployment"("userId");
