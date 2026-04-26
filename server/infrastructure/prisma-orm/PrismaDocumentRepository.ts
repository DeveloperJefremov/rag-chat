import { prisma } from './prismaClient';
import { Document } from '../../../domain/entities/Document';
import { FileType } from '../../../domain/value-objects/FileType';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';
import {
	CreateDocumentData,
	IDocumentRepository,
} from '../../application/repositories/IDocumentRepository';

type Row = {
	id: string;
	name: string;
	fileType: string;
	chunkingStrategy: string;
	userId: string;
	createdAt: Date;
};

const toEntity = (row: Row): Document => ({
	id: row.id,
	name: row.name,
	fileType: row.fileType as FileType,
	chunkingStrategy: row.chunkingStrategy as ChunkingStrategy,
	userId: row.userId,
	createdAt: row.createdAt,
});

export class PrismaDocumentRepository implements IDocumentRepository {
	async create(data: CreateDocumentData): Promise<Document> {
		const doc = await prisma.document.create({ data });
		return toEntity(doc);
	}

	async findById(id: string, userId: string): Promise<Document | null> {
		const doc = await prisma.document.findFirst({ where: { id, userId } });
		return doc ? toEntity(doc) : null;
	}

	async findByIds(ids: string[], userId: string): Promise<Document[]> {
		if (ids.length === 0) return [];
		const docs = await prisma.document.findMany({
			where: { id: { in: ids }, userId },
		});
		return docs.map(toEntity);
	}

	async findAllByUser(userId: string): Promise<Document[]> {
		const docs = await prisma.document.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
		});
		return docs.map(toEntity);
	}

	async findAttachedToSession(sessionId: string, userId: string): Promise<Document[]> {
		const docs = await prisma.document.findMany({
			where: {
				userId,
				sessions: { some: { sessionId } },
			},
			orderBy: { createdAt: 'desc' },
		});
		return docs.map(toEntity);
	}

	async countByUser(userId: string): Promise<number> {
		return prisma.document.count({ where: { userId } });
	}

	async countAttached(sessionId: string): Promise<number> {
		return prisma.sessionDocument.count({ where: { sessionId } });
	}

	async attachToSession(sessionId: string, documentId: string): Promise<void> {
		await prisma.sessionDocument.upsert({
			where: { sessionId_documentId: { sessionId, documentId } },
			create: { sessionId, documentId },
			update: {},
		});
	}

	async detachFromSession(sessionId: string, documentId: string): Promise<void> {
		await prisma.sessionDocument
			.delete({ where: { sessionId_documentId: { sessionId, documentId } } })
			.catch(() => {});
	}

	async deleteById(id: string, userId: string): Promise<void> {
		await prisma.document.deleteMany({ where: { id, userId } });
	}
}
