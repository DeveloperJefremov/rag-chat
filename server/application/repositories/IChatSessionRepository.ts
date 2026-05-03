import { ChatSession } from '../../../domain/entities/ChatSession';

export interface CreateChatSessionData {
	userId: string;
	title?: string;
	expiresAt: Date;
}

export interface UpdateChatSessionData {
	title?: string;
}

export interface FindChatSessionsOptions {
	limit?: number;
	before?: Date;
}

export interface IChatSessionRepository {
	findById(id: string, userId: string): Promise<ChatSession | null>;
	findByUserId(userId: string, options?: FindChatSessionsOptions): Promise<ChatSession[]>;
	countByUser(userId: string): Promise<number>;
	create(data: CreateChatSessionData): Promise<ChatSession>;
	update(id: string, userId: string, data: UpdateChatSessionData): Promise<ChatSession | null>;
	delete(id: string, userId: string): Promise<boolean>;
	deleteExpired(now: Date): Promise<number>;
}
