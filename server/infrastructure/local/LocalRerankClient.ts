import { IRerankClient, RerankCandidate } from '../../application/ports/IRerankClient';
import type { PreTrainedTokenizer, PreTrainedModel } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/bge-reranker-base';

interface LoadedModel {
	tokenizer: PreTrainedTokenizer;
	model: PreTrainedModel;
}

let loadingPromise: Promise<LoadedModel> | null = null;

async function load(): Promise<LoadedModel> {
	if (!loadingPromise) {
		loadingPromise = (async () => {
			const { AutoTokenizer, AutoModelForSequenceClassification, env } =
				await import('@huggingface/transformers');
			env.allowLocalModels = false;
			const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
			const model = await AutoModelForSequenceClassification.from_pretrained(MODEL_ID, {
				dtype: 'q8',
			});
			return { tokenizer, model };
		})().catch(err => {
			loadingPromise = null;
			throw err;
		});
	}
	return loadingPromise;
}

export class LocalRerankClient implements IRerankClient {
	async rerank(params: {
		query: string;
		candidates: RerankCandidate[];
		topN: number;
	}): Promise<RerankCandidate[]> {
		if (params.candidates.length === 0) return [];

		const { tokenizer, model } = await load();

		const queries = params.candidates.map(() => params.query);
		const docs = params.candidates.map(c => c.content);

		const inputs = tokenizer(queries, {
			text_pair: docs,
			padding: true,
			truncation: true,
		});

		const output = (await model(inputs)) as { logits: { tolist: () => number[][] } };
		const scores = output.logits.tolist().map(row => row[0] ?? 0);

		const ranked = params.candidates
			.map((candidate, i) => ({ candidate, score: scores[i] ?? -Infinity }))
			.sort((a, b) => b.score - a.score)
			.slice(0, params.topN)
			.map(({ candidate }) => candidate);

		return ranked;
	}
}
