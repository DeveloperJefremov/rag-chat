import { ChunkingService } from '../../../domain/services/ChunkingService';
import { PrismaChatSessionRepository } from '../prisma-orm/PrismaChatSessionRepository';
import { PrismaDocumentRepository } from '../prisma-orm/PrismaDocumentRepository';
import { PrismaChunkRepository } from '../prisma-orm/PrismaChunkRepository';
import { PrismaMessageRepository } from '../prisma-orm/PrismaMessageRepository';
import { PrismaUserUsageRepository } from '../prisma-orm/PrismaUserUsageRepository';
import { PrismaLLMLogRepository } from '../prisma-orm/PrismaLLMLogRepository';
import { PrismaUserRepository } from '../prisma-orm/PrismaUserRepository';
import { PrismaDeletedUserAuditRepository } from '../prisma-orm/PrismaDeletedUserAuditRepository';
import { GoogleEmbeddingClient } from '../google/GoogleEmbeddingClient';
import { GeminiClient } from '../google/GeminiClient';
import { LocalRerankClient } from '../local/LocalRerankClient';
import { PdfParser } from '../parsers/PdfParser';
import { TxtParser } from '../parsers/TxtParser';
import { DocxParser } from '../parsers/DocxParser';
import { NextAuthContext } from '../auth/NextAuthContext';
import { SessionService } from '../../application/session/SessionService';
import { IngestionService } from '../../application/ingestion/IngestionService';
import { RetrievalService } from '../../application/retrieval/RetrievalService';
import { LLMOpsService } from '../../application/llmops/LLMOpsService';
import { AccountService } from '../../application/account/AccountService';
import { CHUNK_SIZE, CHUNK_OVERLAP } from '../../../shared/config/constants';

const chatSessionRepo = new PrismaChatSessionRepository();
const documentRepo = new PrismaDocumentRepository();
const chunkRepo = new PrismaChunkRepository();
const messageRepo = new PrismaMessageRepository();
const userUsageRepo = new PrismaUserUsageRepository();
const llmLogRepo = new PrismaLLMLogRepository();
const userRepo = new PrismaUserRepository();
const deletedUserAuditRepo = new PrismaDeletedUserAuditRepository();

const embeddingClient = new GoogleEmbeddingClient();
const llmClient = new GeminiClient();
const rerankClient = new LocalRerankClient();
const chunkingService = new ChunkingService({ chunkSize: CHUNK_SIZE, overlap: CHUNK_OVERLAP });

export const llmOpsService = new LLMOpsService(llmLogRepo);

export const sessionService = new SessionService(chatSessionRepo, userUsageRepo);

export const ingestionService = new IngestionService({
	documentRepo,
	chunkRepo,
	parsers: { PDF: new PdfParser(), TXT: new TxtParser(), DOCX: new DocxParser() },
	embeddingClient,
	chunkingService,
});

export const retrievalService = new RetrievalService({
	chunkRepo,
	embeddingClient,
	llmClient,
	messageRepo,
	chatSessionRepo,
	sessionService,
	rerankClient,
	llmOpsService,
});

export { documentRepo, chatSessionRepo, messageRepo };

export const authContext = new NextAuthContext();

export const accountService = new AccountService(
	userRepo,
	chatSessionRepo,
	documentRepo,
	llmLogRepo,
	deletedUserAuditRepo,
);
