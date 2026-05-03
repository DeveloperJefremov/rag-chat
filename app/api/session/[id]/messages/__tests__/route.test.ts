import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuthContext, mockChatSessionRepo, mockMessageRepo } = vi.hoisted(() => ({
	mockAuthContext: { requireUser: vi.fn(), requireAdmin: vi.fn(), getUser: vi.fn() },
	mockChatSessionRepo: { findById: vi.fn() },
	mockMessageRepo: { findBySessionId: vi.fn(), findRecentBySessionId: vi.fn(), saveMany: vi.fn() },
}));

vi.mock('@/server/infrastructure/http/container', () => ({
	authContext: mockAuthContext,
	chatSessionRepo: mockChatSessionRepo,
	messageRepo: mockMessageRepo,
}));

import { GET } from '../route';

describe('GET /api/session/[id]/messages', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('passes default limit (50) when no query params', async () => {
		mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
		mockChatSessionRepo.findById.mockResolvedValueOnce({ id: 's', userId: 'u' });
		mockMessageRepo.findBySessionId.mockResolvedValueOnce([]);

		const res = await GET(new Request('http://localhost/api/session/s/messages'), {
			params: Promise.resolve({ id: 's' }),
		});

		expect(res.status).toBe(200);
		expect(mockMessageRepo.findBySessionId).toHaveBeenCalledWith('s', {
			limit: 50,
			before: undefined,
		});
	});

	it('clamps limit to MAX_PAGE_SIZE=200 and parses before cursor', async () => {
		mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
		mockChatSessionRepo.findById.mockResolvedValueOnce({ id: 's', userId: 'u' });
		mockMessageRepo.findBySessionId.mockResolvedValueOnce([]);

		await GET(
			new Request(
				'http://localhost/api/session/s/messages?limit=10000&before=2026-04-01T00:00:00.000Z',
			),
			{ params: Promise.resolve({ id: 's' }) },
		);

		expect(mockMessageRepo.findBySessionId).toHaveBeenCalledWith('s', {
			limit: 200,
			before: new Date('2026-04-01T00:00:00.000Z'),
		});
	});

	it('returns 400 on invalid before', async () => {
		mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
		mockChatSessionRepo.findById.mockResolvedValueOnce({ id: 's', userId: 'u' });

		const res = await GET(new Request('http://localhost/api/session/s/messages?before=garbage'), {
			params: Promise.resolve({ id: 's' }),
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'invalid_before' });
		expect(mockMessageRepo.findBySessionId).not.toHaveBeenCalled();
	});

	it('returns 404 when session not owned', async () => {
		mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
		mockChatSessionRepo.findById.mockResolvedValueOnce(null);

		const res = await GET(new Request('http://localhost/api/session/s/messages'), {
			params: Promise.resolve({ id: 's' }),
		});

		expect(res.status).toBe(404);
	});
});
