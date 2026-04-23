import { prisma } from './prismaClient';
import { ChatSession } from '../../../domain/entities/ChatSession';
import {
	CreateChatSessionData,
	IChatSessionRepository,
} from '../../application/repositories/IChatSessionRepository';

export class PrismaChatSessionRepository implements IChatSessionRepository {
	async findById(id: string, userId: string): Promise<ChatSession | null> {
		const session = await prisma.chatSession.findFirst({ where: { id, userId } });
		if (!session) return null;
		return {
			id: session.id,
			title: session.title,
			userId: session.userId,
			createdAt: session.createdAt,
			expiresAt: session.expiresAt,
		};
	}

	async findByUserId(userId: string): Promise<ChatSession[]> {
		const sessions = await prisma.chatSession.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
		});
		return sessions.map(s => ({
			id: s.id,
			title: s.title,
			userId: s.userId,
			createdAt: s.createdAt,
			expiresAt: s.expiresAt,
		}));
	}

	async create(data: CreateChatSessionData): Promise<ChatSession> {
		const session = await prisma.chatSession.create({
			data: {
				userId: data.userId,
				title: data.title ?? null,
				expiresAt: data.expiresAt,
			},
		});
		return {
			id: session.id,
			title: session.title,
			userId: session.userId,
			createdAt: session.createdAt,
			expiresAt: session.expiresAt,
		};
	}
}
