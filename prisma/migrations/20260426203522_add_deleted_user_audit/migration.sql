-- CreateTable
CREATE TABLE "deleted_user_audits" (
    "id" TEXT NOT NULL,
    "originalUserId" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "UserRole" NOT NULL,
    "totalQueries" INTEGER NOT NULL DEFAULT 0,
    "totalDocuments" INTEGER NOT NULL DEFAULT 0,
    "totalChatSessions" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPromptTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCompletionTokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "deleted_user_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deleted_user_audits_deletedAt_idx" ON "deleted_user_audits"("deletedAt");
