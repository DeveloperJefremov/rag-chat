export type MessageRole = 'USER' | 'ASSISTANT';

export interface Message {
	id: string;
	role: MessageRole;
	content: string;
	sessionId: string;
	createdAt: Date;
}
