import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuthContext, mockSessionService, mockChatSessionRepo } = vi.hoisted(() => ({
	mockAuthContext: {
		requireUser: vi.fn(),
		requireAdmin: vi.fn(),
		getUser: vi.fn(),
	},
	mockSessionService: { getOrCreate: vi.fn() },
	mockChatSessionRepo: { findByUserId: vi.fn() },
}));

vi.mock('@/server/infrastructure/http/container', () => ({
	authContext: mockAuthContext,
	sessionService: mockSessionService,
	chatSessionRepo: mockChatSessionRepo,
}));

import { GET, POST } from '../route';

const makeReq = (url = 'http://localhost/api/session') => new Request(url);

describe('/api/session', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('GET', () => {
		it('returns 401 when unauthenticated', async () => {
			const { Unauthenticated } = await import('@/shared/errors/AppError');
			mockAuthContext.requireUser.mockRejectedValueOnce(Unauthenticated());

			const res = await GET(makeReq(), { params: Promise.resolve({}) });

			expect(res.status).toBe(401);
			expect(await res.json()).toEqual({ error: 'unauthenticated' });
		});

		it('returns sessions mapped to DTOs', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({
				id: 'u',
				email: 'e',
				role: 'USER',
			});
			const created = new Date('2026-01-01T00:00:00.000Z');
			const expires = new Date('2026-01-02T00:00:00.000Z');
			mockChatSessionRepo.findByUserId.mockResolvedValueOnce([
				{ id: 's1', title: 'T1', userId: 'u', createdAt: created, expiresAt: expires },
			]);

			const res = await GET(makeReq(), { params: Promise.resolve({}) });

			expect(res.status).toBe(200);
			expect(await res.json()).toEqual([
				{
					id: 's1',
					title: 'T1',
					createdAt: '2026-01-01T00:00:00.000Z',
					expiresAt: '2026-01-02T00:00:00.000Z',
				},
			]);
			expect(mockChatSessionRepo.findByUserId).toHaveBeenCalledWith('u', {
				limit: 50,
				before: undefined,
			});
		});

		it('clamps limit and parses before cursor', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
			mockChatSessionRepo.findByUserId.mockResolvedValueOnce([]);

			await GET(
				makeReq('http://localhost/api/session?limit=9999&before=2026-04-01T00:00:00.000Z'),
				{
					params: Promise.resolve({}),
				},
			);

			expect(mockChatSessionRepo.findByUserId).toHaveBeenCalledWith('u', {
				limit: 200,
				before: new Date('2026-04-01T00:00:00.000Z'),
			});
		});

		it('returns 400 on invalid before', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });

			const res = await GET(makeReq('http://localhost/api/session?before=garbage'), {
				params: Promise.resolve({}),
			});

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'invalid_before' });
			expect(mockChatSessionRepo.findByUserId).not.toHaveBeenCalled();
		});
	});

	describe('POST', () => {
		it('creates session and returns 201 with DTO', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({
				id: 'u',
				email: 'e',
				role: 'USER',
			});
			const created = new Date('2026-02-01T00:00:00.000Z');
			const expires = new Date('2026-02-02T00:00:00.000Z');
			mockSessionService.getOrCreate.mockResolvedValueOnce({
				id: 's2',
				title: null,
				userId: 'u',
				createdAt: created,
				expiresAt: expires,
			});

			const res = await POST(makeReq(), { params: Promise.resolve({}) });

			expect(res.status).toBe(201);
			expect(await res.json()).toEqual({
				id: 's2',
				title: null,
				createdAt: '2026-02-01T00:00:00.000Z',
				expiresAt: '2026-02-02T00:00:00.000Z',
			});
			expect(mockSessionService.getOrCreate).toHaveBeenCalledWith('u', null, 'USER');
		});

		it('returns 403 when the chat sessions limit is reached', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({
				id: 'u',
				email: 'e',
				role: 'USER',
			});
			const { ChatSessionsLimitReached } = await import('@/shared/errors/AppError');
			mockSessionService.getOrCreate.mockRejectedValueOnce(ChatSessionsLimitReached());

			const res = await POST(makeReq(), { params: Promise.resolve({}) });

			expect(res.status).toBe(403);
			expect(await res.json()).toEqual({ error: 'chat_sessions_limit_reached' });
		});

		it('maps internal failure to 500', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({
				id: 'u',
				email: 'e',
				role: 'USER',
			});
			mockSessionService.getOrCreate.mockRejectedValueOnce(new Error('boom'));
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const res = await POST(makeReq(), { params: Promise.resolve({}) });

			expect(res.status).toBe(500);
			expect(await res.json()).toEqual({ error: 'internal_error' });
			consoleSpy.mockRestore();
		});
	});
});
