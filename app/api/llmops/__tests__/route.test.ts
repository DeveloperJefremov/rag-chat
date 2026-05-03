import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuthContext, mockLLMOpsService } = vi.hoisted(() => ({
	mockAuthContext: { requireUser: vi.fn(), requireAdmin: vi.fn(), getUser: vi.fn() },
	mockLLMOpsService: { getStats: vi.fn() },
}));

vi.mock('@/server/infrastructure/http/container', () => ({
	authContext: mockAuthContext,
	llmOpsService: mockLLMOpsService,
}));

import { GET } from '../route';

const makeReq = () => new Request('http://localhost/api/llmops');

describe('/api/llmops', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 when unauthenticated', async () => {
		const { Unauthenticated } = await import('@/shared/errors/AppError');
		mockAuthContext.requireAdmin.mockRejectedValueOnce(Unauthenticated());

		const res = await GET(makeReq(), { params: Promise.resolve({}) });

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({ error: 'unauthenticated' });
	});

	it('returns 403 for non-admin users', async () => {
		const { Forbidden } = await import('@/shared/errors/AppError');
		mockAuthContext.requireAdmin.mockRejectedValueOnce(Forbidden());

		const res = await GET(makeReq(), { params: Promise.resolve({}) });

		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: 'forbidden' });
	});

	it('returns stats for admin', async () => {
		mockAuthContext.requireAdmin.mockResolvedValueOnce({
			id: 'a',
			email: 'a@x',
			role: 'ADMIN',
		});
		mockLLMOpsService.getStats.mockResolvedValueOnce({ total: 7, logs: [] });

		const res = await GET(makeReq(), { params: Promise.resolve({}) });

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ total: 7, logs: [] });
		expect(mockLLMOpsService.getStats).toHaveBeenCalledWith(100);
	});
});
