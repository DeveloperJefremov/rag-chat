import { SessionApi } from './http/SessionApi';
import { IngestionApi } from './http/IngestionApi';
import { ChatApi } from './http/ChatApi';
import { LLMOpsApi } from './http/LLMOpsApi';
import { AccountApi } from './http/AccountApi';
import { UsageApi } from './http/UsageApi';
import { IngestionClientService } from '../application/services/IngestionClientService';
import { ChatSessionService } from '../application/services/ChatSessionService';

const sessionApi = new SessionApi();
const ingestionApi = new IngestionApi();
const chatApi = new ChatApi();
const llmOpsApi = new LLMOpsApi();
const accountApi = new AccountApi();
const usageApi = new UsageApi();

export const ingestionClientService = new IngestionClientService(ingestionApi);
export const chatSessionService = new ChatSessionService(chatApi);
export { sessionApi, llmOpsApi, ingestionApi, accountApi, usageApi };
