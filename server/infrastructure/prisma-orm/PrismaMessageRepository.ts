import { prisma } from './prismaClient';
import { Message, MessageRole } from '../../../domain/entities/Message';
import { IMessageRepository } from '../../application/repositories/IMessageRepository';

export class PrismaMessageRepository implements IMessageRepository {
	async saveMany(
		messages: Array<{ role: MessageRole; content: string; sessionId: string }>,
	): Promise<Message[]> {
		const created = await prisma.$transaction(
			messages.map(m => prisma.message.create({ data: m })),
		);
		return created.map(m => ({
			id: m.id,
			role: m.role as MessageRole,
			content: m.content,
			sessionId: m.sessionId,
			createdAt: m.createdAt,
		}));
	}

	async findBySessionId(sessionId: string): Promise<Message[]> {
		const messages = await prisma.message.findMany({
			where: { sessionId },
			orderBy: { createdAt: 'asc' },
		});
		return messages.map(m => ({
			id: m.id,
			role: m.role as MessageRole,
			content: m.content,
			sessionId: m.sessionId,
			createdAt: m.createdAt,
		}));
	}
}
