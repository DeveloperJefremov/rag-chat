import { CitationDto } from '../../shared/dtos/CitationDto';

export type MessageRole = 'USER' | 'ASSISTANT';

export interface Message {
	id: string;
	role: MessageRole;
	content: string;
	citations: CitationDto[] | null;
	sessionId: string;
	createdAt: Date;
}
