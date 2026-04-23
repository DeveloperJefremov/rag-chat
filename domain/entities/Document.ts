import { FileType } from '../value-objects/FileType';
import { ChunkingStrategy } from '../value-objects/ChunkingStrategy';

export interface Document {
	id: string;
	name: string;
	fileType: FileType;
	chunkingStrategy: ChunkingStrategy;
	userId: string;
	sessionId: string;
	createdAt: Date;
}
