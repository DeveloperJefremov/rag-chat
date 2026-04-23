import { prisma } from './prismaClient';
import { Document } from '../../../domain/entities/Document';
import { FileType } from '../../../domain/value-objects/FileType';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';
import {
	CreateDocumentData,
	IDocumentRepository,
} from '../../application/repositories/IDocumentRepository';

export class PrismaDocumentRepository implements IDocumentRepository {
	async create(data: CreateDocumentData): Promise<Document> {
		const doc = await prisma.document.create({ data });
		return {
			id: doc.id,
			name: doc.name,
			fileType: doc.fileType as FileType,
			chunkingStrategy: doc.chunkingStrategy as ChunkingStrategy,
			userId: doc.userId,
			sessionId: doc.sessionId,
			createdAt: doc.createdAt,
		};
	}

	async findById(id: string): Promise<Document | null> {
		const doc = await prisma.document.findUnique({ where: { id } });
		if (!doc) return null;
		return {
			id: doc.id,
			name: doc.name,
			fileType: doc.fileType as FileType,
			chunkingStrategy: doc.chunkingStrategy as ChunkingStrategy,
			userId: doc.userId,
			sessionId: doc.sessionId,
			createdAt: doc.createdAt,
		};
	}

	async findBySessionId(sessionId: string): Promise<Document[]> {
		const docs = await prisma.document.findMany({
			where: { sessionId },
			orderBy: { createdAt: 'desc' },
		});
		return docs.map(doc => ({
			id: doc.id,
			name: doc.name,
			fileType: doc.fileType as FileType,
			chunkingStrategy: doc.chunkingStrategy as ChunkingStrategy,
			userId: doc.userId,
			sessionId: doc.sessionId,
			createdAt: doc.createdAt,
		}));
	}

	async deleteById(id: string): Promise<void> {
		await prisma.document.delete({ where: { id } }).catch(() => {});
	}
}
