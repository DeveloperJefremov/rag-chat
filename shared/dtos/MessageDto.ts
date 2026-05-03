import { CitationDto } from './CitationDto';
import { Message } from '@/domain/entities/Message';

export type MessageRole = 'USER' | 'ASSISTANT';

export interface MessageDto {
	id: string;
	role: MessageRole;
	content: string;
	citations?: CitationDto[];
	createdAt: string;
}

export function toMessageDto(message: Message): MessageDto {
	return {
		id: message.id,
		role: message.role,
		content: message.content,
		citations: message.citations ?? undefined,
		createdAt: message.createdAt.toISOString(),
	};
}
