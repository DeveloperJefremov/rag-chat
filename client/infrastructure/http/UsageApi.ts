import { IUsageApi } from '../../application/api/IUsageApi';
import { UsageDto } from '../../../shared/dtos/UsageDto';
import { apiFetch } from './apiFetch';

export class UsageApi implements IUsageApi {
	async getUsage(): Promise<UsageDto> {
		const res = await apiFetch('/api/usage');
		if (!res.ok) throw new Error('usage_fetch_failed');
		return res.json();
	}
}
