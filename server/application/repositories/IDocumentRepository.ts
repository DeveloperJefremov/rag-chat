import { Document } from '../../../domain/entities/Document';
import { FileType } from '../../../domain/value-objects/FileType';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

export interface CreateDocumentData {
	name: string;
	fileType: FileType;
	chunkingStrategy: ChunkingStrategy;
	userId: string;
}

export interface FindDocumentsOptions {
	limit?: number;
	before?: Date;
}

export interface IDocumentRepository {
	create(data: CreateDocumentData): Promise<Document>;
	findById(id: string, userId: string): Promise<Document | null>;
	findByIds(ids: string[], userId: string): Promise<Document[]>;
	findAllByUser(userId: string, options?: FindDocumentsOptions): Promise<Document[]>;
	findAttachedToSession(sessionId: string, userId: string): Promise<Document[]>;
	countByUser(userId: string): Promise<number>;
	countAttached(sessionId: string): Promise<number>;
	attachToSession(sessionId: string, documentId: string): Promise<void>;
	detachFromSession(sessionId: string, documentId: string): Promise<void>;
	deleteById(id: string, userId: string): Promise<void>;
}
