import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionApi } from '../SessionApi';

describe('SessionApi.createSession', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('returns the DTO on 201', async () => {
		global.fetch = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					id: 's1',
					title: null,
					createdAt: '2026-05-17T00:00:00.000Z',
					expiresAt: '2026-05-18T00:00:00.000Z',
				}),
				{ status: 201, headers: { 'Content-Type': 'application/json' } },
			),
		);

		const api = new SessionApi();
		const dto = await api.createSession();

		expect(dto.id).toBe('s1');
	});

	it('throws Error with the server error code when body has { error: code }', async () => {
		global.fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: 'chat_sessions_limit_reached' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' },
			}),
		);

		const api = new SessionApi();

		await expect(api.createSession()).rejects.toThrow('chat_sessions_limit_reached');
	});

	it('falls back to session_create_failed when body is not parseable', async () => {
		global.fetch = vi.fn().mockResolvedValue(
			new Response('<<not json>>', {
				status: 500,
				headers: { 'Content-Type': 'text/plain' },
			}),
		);

		const api = new SessionApi();

		await expect(api.createSession()).rejects.toThrow('session_create_failed');
	});
});
