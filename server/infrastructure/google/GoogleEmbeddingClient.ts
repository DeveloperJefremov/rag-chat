import { IEmbeddingClient } from '../../application/ports/IEmbeddingClient';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';

export class GoogleEmbeddingClient implements IEmbeddingClient {
	private genAI: GoogleGenerativeAI;
	private model = 'text-embedding-004';

	constructor() {
		if (!process.env.GOOGLE_AI_KEY) {
			throw new Error('GOOGLE_AI_KEY is not set');
		}
		this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
	}

	async embed(text: string): Promise<number[]> {
		const model = this.genAI.getGenerativeModel({ model: this.model });
		const result = await model.embedContent(text);
		return result.embedding.values;
	}

	async embedBatch(texts: string[]): Promise<number[][]> {
		const model = this.genAI.getGenerativeModel({ model: this.model });
		const response = await model.batchEmbedContents({
			requests: texts.map(content => ({
				content: { parts: [{ text: content }], role: 'user' },
				taskType: TaskType.RETRIEVAL_DOCUMENT,
			})),
		});
		return response.embeddings.map(e => e.values);
	}
}
