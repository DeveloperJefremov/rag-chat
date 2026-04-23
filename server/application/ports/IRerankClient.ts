export interface RerankCandidate {
	content: string;
	originalIndex: number;
}

export interface IRerankClient {
	rerank(params: {
		query: string;
		candidates: RerankCandidate[];
		topN: number;
	}): Promise<RerankCandidate[]>;
}
