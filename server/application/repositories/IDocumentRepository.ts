import { Document } from '../../../domain/entities/Document';
import { FileType } from '../../../domain/value-objects/FileType';
import { ChunkingStrategy } from '../../../domain/value-objects/ChunkingStrategy';

export interface CreateDocumentData {
	name: string;
	fileType: FileType;
	chunkingStrategy: ChunkingStrategy;
	userId: string;
	sessionId: string;
}

export interface IDocumentRepository {
	create(data: CreateDocumentData): Promise<Document>;
	findById(id: string): Promise<Document | null>;
	findBySessionId(sessionId: string): Promise<Document[]>;
	deleteById(id: string): Promise<void>;
}
