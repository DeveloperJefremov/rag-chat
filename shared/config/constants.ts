export const SESSION_TTL_HOURS = 24;
export const CHUNK_SIZE = 512;
export const CHUNK_OVERLAP = 50;
export const TOP_K_CHUNKS = 5;
export const MAX_FILE_SIZE_MB = 10;
export const EMBEDDING_DIMS = 768;
export const IP_RATE_LIMIT_RPM = 60;
export const SUPPORTED_FILE_TYPES = ['pdf', 'txt', 'docx'] as const;
export const MAX_HISTORY_MESSAGES = 10;
export const MAX_CHAT_MESSAGE_CHARS = 4000;
export const LLMLOG_RETENTION_DAYS = 90;

export const COST_USD_PER_M_EMBED_TOKENS = 0.01;
export const COST_USD_PER_M_GEMINI_INPUT_TOKENS = 0.075;
export const COST_USD_PER_M_GEMINI_OUTPUT_TOKENS = 0.3;
export const COST_USD_PER_RERANK_CALL = 0.002;
