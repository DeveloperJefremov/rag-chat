import { ISessionApi } from '../../application/api/ISessionApi';
import { SessionDto } from '../../../shared/dtos/SessionDto';
import { apiFetch } from './apiFetch';

export class SessionApi implements ISessionApi {
	async getSessions(): Promise<SessionDto[]> {
		const res = await apiFetch('/api/session');
		if (!res.ok) throw new Error('session_fetch_failed');
		return res.json();
	}

	async createSession(): Promise<SessionDto> {
		const res = await apiFetch('/api/session', { method: 'POST' });
		if (!res.ok) {
			const body = (await res.json().catch(() => null)) as { error?: string } | null;
			throw new Error(body?.error ?? 'session_create_failed');
		}
		return res.json();
	}

	async deleteSession(id: string): Promise<void> {
		const res = await apiFetch(`/api/session/${encodeURIComponent(id)}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('session_delete_failed');
	}
}
