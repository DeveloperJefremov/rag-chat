import { ChatSession } from '../../../domain/entities/ChatSession';

export interface CreateChatSessionData {
	userId: string;
	title?: string;
	expiresAt: Date;
}

export interface IChatSessionRepository {
	findById(id: string, userId: string): Promise<ChatSession | null>;
	findByUserId(userId: string): Promise<ChatSession[]>;
	create(data: CreateChatSessionData): Promise<ChatSession>;
}
