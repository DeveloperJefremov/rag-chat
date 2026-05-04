import { IAccountApi } from '../../application/api/IAccountApi';
import { apiFetch } from './apiFetch';

export class AccountApi implements IAccountApi {
	async deleteAccount(): Promise<void> {
		const res = await apiFetch('/api/account', { method: 'DELETE' });
		if (!res.ok) throw new Error('account_delete_failed');
	}
}
