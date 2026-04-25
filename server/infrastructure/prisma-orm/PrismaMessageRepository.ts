import { Prisma } from '../../../prisma/generated/prisma';
import { prisma } from './prismaClient';
import { Message, MessageRole } from '../../../domain/entities/Message';
import {
	IMessageRepository,
	SaveMessageInput,
} from '../../application/repositories/IMessageRepository';
import { CitationDto } from '../../../shared/dtos/CitationDto';

function parseCitations(raw: unknown): CitationDto[] | null {
	if (!Array.isArray(raw)) return null;
	return raw as CitationDto[];
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
		return created.map(m => ({
			id: m.id,
			role: m.role as MessageRole,
			content: m.content,
			citations: parseCitations(m.citations),
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
			citations: parseCitations(m.citations),
			sessionId: m.sessionId,
			createdAt: m.createdAt,
		}));
	}
}
