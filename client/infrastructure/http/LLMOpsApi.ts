import { ILLMOpsApi, LLMOpsStats } from '../../application/api/ILLMOpsApi';
import { apiFetch } from './apiFetch';

export class LLMOpsApi implements ILLMOpsApi {
	async getStats(): Promise<LLMOpsStats> {
		const res = await apiFetch('/api/llmops');
		if (!res.ok) throw new Error('llmops_fetch_failed');
		return res.json();
	}
}
