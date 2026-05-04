import { IEmbeddingClient } from '../../application/ports/IEmbeddingClient';
import { GoogleGenAI } from '@google/genai';

const EMBEDDING_DIM = 768;

export class GoogleEmbeddingClient implements IEmbeddingClient {
	private genAI: GoogleGenAI;
	private model = 'gemini-embedding-001';

	constructor() {
		if (!process.env.GOOGLE_AI_KEY) {
			throw new Error('GOOGLE_AI_KEY is not set');
		}
		this.genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_KEY });
	}

	async embed(text: string): Promise<number[]> {
		const response = await this.genAI.models.embedContent({
			model: this.model,
			contents: [text],
			config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: EMBEDDING_DIM },
		});
		const values = response.embeddings?.[0]?.values;
		if (!values) throw new Error('embedding_missing');
		return values;
	}

	async embedBatch(texts: string[]): Promise<number[][]> {
		const response = await this.genAI.models.embedContent({
			model: this.model,
			contents: texts,
			config: { taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: EMBEDDING_DIM },
		});
		if (!response.embeddings) throw new Error('embeddings_missing');
		return response.embeddings.map(e => {
			if (!e.values) throw new Error('embedding_values_missing');
			return e.values;
		});
	}
}
