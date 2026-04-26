import { prisma } from './prismaClient';
import { Chunk } from '../../../domain/entities/Chunk';
import { CreateChunkData, IChunkRepository } from '../../application/repositories/IChunkRepository';

export class PrismaChunkRepository implements IChunkRepository {
	async saveMany(chunks: CreateChunkData[]): Promise<void> {
		if (chunks.length === 0) return;
		await prisma.$transaction(async tx => {
			for (const chunk of chunks) {
				await tx.$executeRaw`
          INSERT INTO chunks (id, content, embedding, "documentId")
          VALUES (
            gen_random_uuid(),
            ${chunk.content},
            ${`[${chunk.embedding.join(',')}]`}::vector,
            ${chunk.documentId}
          )
        `;
			}
		});
	}

	async similaritySearch(params: {
		queryVector: number[];
		documentIds: string[];
		userId: string;
		topK: number;
	}): Promise<Chunk[]> {
		if (params.documentIds.length === 0) return [];
		if (params.queryVector.some(v => !Number.isFinite(v))) {
			throw new Error('Invalid query vector: contains non-finite values');
		}
		const vectorLiteral = `[${params.queryVector.join(',')}]`;
		const topK = Math.max(1, Math.floor(params.topK));

		const results = await prisma.$queryRaw<
			Array<{ id: string; content: string; documentId: string }>
		>`
      SELECT c.id, c.content, c."documentId"
      FROM chunks c
      JOIN documents d ON d.id = c."documentId"
      WHERE c."documentId" = ANY(${params.documentIds}::text[])
        AND d."userId" = ${params.userId}
      ORDER BY c.embedding <=> ${vectorLiteral}::vector
      LIMIT ${topK}
    `;

		return results.map(r => ({
			id: r.id,
			content: r.content,
			embedding: [],
			documentId: r.documentId,
		}));
	}
}
