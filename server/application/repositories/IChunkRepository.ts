import { Chunk } from '../../../domain/entities/Chunk';

export interface CreateChunkData {
	content: string;
	embedding: number[];
	documentId: string;
}

export interface IChunkRepository {
	saveMany(chunks: CreateChunkData[]): Promise<void>;
	similaritySearch(params: {
		queryVector: number[];
		documentIds: string[];
		userId: string;
		topK: number;
	}): Promise<Chunk[]>;
}
