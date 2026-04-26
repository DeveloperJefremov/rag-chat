-- Wipe existing documents and chunks (clean-start migration; Document is being detached from ChatSession).
TRUNCATE TABLE "chunks", "documents" RESTART IDENTITY CASCADE;

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_sessionId_fkey";

-- DropIndex
DROP INDEX "documents_sessionId_idx";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "sessionId";

-- CreateTable
CREATE TABLE "session_documents" (
    "sessionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_documents_pkey" PRIMARY KEY ("sessionId","documentId")
);

-- CreateIndex
CREATE INDEX "session_documents_documentId_idx" ON "session_documents"("documentId");

-- AddForeignKey
ALTER TABLE "session_documents" ADD CONSTRAINT "session_documents_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_documents" ADD CONSTRAINT "session_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
