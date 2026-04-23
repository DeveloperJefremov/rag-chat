import { Message, MessageRole } from '../../../domain/entities/Message';

export interface IMessageRepository {
	saveMany(
		messages: Array<{ role: MessageRole; content: string; sessionId: string }>,
	): Promise<Message[]>;
	findBySessionId(sessionId: string): Promise<Message[]>;
}
