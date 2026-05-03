import { Prisma } from '../../../prisma/generated/prisma';
import { prisma } from './prismaClient';
import { Message, MessageRole } from '../../../domain/entities/Message';
import {
	FindMessagesOptions,
	IMessageRepository,
	SaveMessageInput,
} from '../../application/repositories/IMessageRepository';
import { CitationDto } from '../../../shared/dtos/CitationDto';

function parseCitations(raw: unknown): CitationDto[] | null {
	if (!Array.isArray(raw)) return null;
	return raw as CitationDto[];
}

function toMessage(m: {
	id: string;
	role: string;
	content: string;
	citations: unknown;
	sessionId: string;
	createdAt: Date;
}): Message {
	return {
		id: m.id,
		role: m.role as MessageRole,
		content: m.content,
		citations: parseCitations(m.citations),
		sessionId: m.sessionId,
		createdAt: m.createdAt,
	};
}

export class PrismaMessageRepository implements IMessageRepository {
	async saveMany(messages: SaveMessageInput[]): Promise<Message[]> {
		const created = await prisma.$transaction(
			messages.map(m =>
				prisma.message.create({
					data: {
						role: m.role,
						content: m.content,
						sessionId: m.sessionId,
						citations: m.citations
							? (m.citations as unknown as Prisma.InputJsonValue)
							: Prisma.JsonNull,
					},
				}),
			),
		);
		return created.map(toMessage);
	}

	async findBySessionId(sessionId: string, options?: FindMessagesOptions): Promise<Message[]> {
		const messages = await prisma.message.findMany({
			where: {
				sessionId,
				...(options?.before ? { createdAt: { lt: options.before } } : {}),
			},
			orderBy: { createdAt: 'asc' },
			...(options?.limit ? { take: options.limit } : {}),
		});
		return messages.map(toMessage);
	}

	async findRecentBySessionId(sessionId: string, limit: number): Promise<Message[]> {
		const messages = await prisma.message.findMany({
			where: { sessionId },
			orderBy: { createdAt: 'desc' },
			take: Math.max(1, Math.floor(limit)),
		});
		return messages.reverse().map(toMessage);
	}
}
