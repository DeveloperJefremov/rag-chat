import { CitationDto } from './CitationDto';

export type MessageRole = 'USER' | 'ASSISTANT';

export interface MessageDto {
	id: string;
	role: MessageRole;
	content: string;
	citations?: CitationDto[];
	createdAt: string;
}
