import { IChatApi, StreamChatParams } from '../api/IChatApi';
import { CitationDto } from '../../../shared/dtos/CitationDto';
import { MessageDto } from '../../../shared/dtos/MessageDto';

export interface StreamCallbacks {
	onUserMessage: (msg: MessageDto) => void;
	onAssistantStart: (msg: MessageDto) => void;
	onSources: (sources: CitationDto[]) => void;
	onChunk: (text: string) => void;
	onError: (error: string) => void;
	onDone: () => void;
}

export class ChatSessionService {
	constructor(private api: IChatApi) {}

	async send(params: StreamChatParams, cb: StreamCallbacks): Promise<void> {
		const now = new Date().toISOString();

		cb.onUserMessage({
			id: crypto.randomUUID(),
			role: 'USER',
			content: params.message,
			createdAt: now,
		});

		cb.onAssistantStart({
			id: crypto.randomUUID(),
			role: 'ASSISTANT',
			content: '',
			createdAt: now,
		});

		for await (const event of this.api.streamChat(params)) {
			if (event.type === 'sources') cb.onSources(event.sources);
			else if (event.type === 'chunk') cb.onChunk(event.text);
			else if (event.type === 'error') {
				cb.onError(event.error);
				break;
			} else if (event.type === 'done') {
				cb.onDone();
				break;
			}
		}
	}
}
