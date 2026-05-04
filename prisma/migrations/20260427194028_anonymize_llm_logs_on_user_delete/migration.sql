-- AlterTable
ALTER TABLE "llm_logs" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "llm_logs" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
