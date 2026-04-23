import { ISessionApi } from '../../application/api/ISessionApi';
import { SessionDto } from '../../../shared/dtos/SessionDto';

export class SessionApi implements ISessionApi {
	async getSessions(): Promise<SessionDto[]> {
		const res = await fetch('/api/session');
		if (!res.ok) throw new Error('session_fetch_failed');
		return res.json();
	}

	async createSession(): Promise<SessionDto> {
		const res = await fetch('/api/session', { method: 'POST' });
		if (!res.ok) throw new Error('session_create_failed');
		return res.json();
	}
}
