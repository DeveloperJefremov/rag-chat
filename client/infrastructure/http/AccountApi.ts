import { IAccountApi } from '../../application/api/IAccountApi';

export class AccountApi implements IAccountApi {
	async deleteAccount(): Promise<void> {
		const res = await fetch('/api/account', { method: 'DELETE' });
		if (!res.ok) throw new Error('account_delete_failed');
	}
}
