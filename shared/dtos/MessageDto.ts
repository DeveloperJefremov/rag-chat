export type MessageRole = 'USER' | 'ASSISTANT';

export interface MessageDto {
	id: string;
	role: MessageRole;
	content: string;
	createdAt: string;
}
