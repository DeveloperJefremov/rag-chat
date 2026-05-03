import {
	IRerankClient,
	RerankCandidate,
	RerankResult,
} from '../../application/ports/IRerankClient';
import { CohereClient } from 'cohere-ai';

export class CohereRerankClient implements IRerankClient {
	private client: CohereClient;

	constructor() {
		if (!process.env.COHERE_API_KEY) {
			throw new Error('COHERE_API_KEY is not set');
		}
		this.client = new CohereClient({ token: process.env.COHERE_API_KEY });
	}

	async rerank(params: {
		query: string;
		candidates: RerankCandidate[];
		topN: number;
	}): Promise<RerankResult[]> {
		const response = await this.client.rerank({
			model: 'rerank-v3.5',
			query: params.query,
			documents: params.candidates.map(c => c.content),
			topN: params.topN,
		});

		return response.results.map(r => ({
			...params.candidates[r.index],
			score: r.relevanceScore,
		}));
	}
}
