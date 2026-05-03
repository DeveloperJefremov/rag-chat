import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuthContext, mockChatSessionRepo, mockDocumentRepo, mockSessionService } = vi.hoisted(
	() => ({
		mockAuthContext: { requireUser: vi.fn(), requireAdmin: vi.fn(), getUser: vi.fn() },
		mockChatSessionRepo: { findById: vi.fn() },
		mockDocumentRepo: {
			findAttachedToSession: vi.fn(),
			findById: vi.fn(),
			countAttached: vi.fn(),
			attachToSession: vi.fn(),
		},
		mockSessionService: { validateAttachedLimit: vi.fn() },
	}),
);

vi.mock('@/server/infrastructure/http/container', () => ({
	authContext: mockAuthContext,
	chatSessionRepo: mockChatSessionRepo,
	documentRepo: mockDocumentRepo,
	sessionService: mockSessionService,
}));

import { GET, POST } from '../route';
import { AttachedLimitReached } from '@/shared/errors/AppError';

const session = (overrides = {}) => ({
	id: 's1',
	title: null,
	userId: 'u',
	createdAt: new Date(),
	expiresAt: new Date(Date.now() + 86400000),
	...overrides,
});

describe('/api/session/[id]/documents', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('GET', () => {
		it('returns 404 when session not owned', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
			mockChatSessionRepo.findById.mockResolvedValueOnce(null);

			const res = await GET(new Request('http://localhost/api/session/s1/documents'), {
				params: Promise.resolve({ id: 's1' }),
			});

			expect(res.status).toBe(404);
			expect(await res.json()).toEqual({ error: 'session_not_found' });
		});

		it('returns attached docs as DTOs', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
			mockChatSessionRepo.findById.mockResolvedValueOnce(session());
			mockDocumentRepo.findAttachedToSession.mockResolvedValueOnce([
				{
					id: 'd1',
					name: 'a.pdf',
					fileType: 'PDF',
					chunkingStrategy: 'RECURSIVE',
					userId: 'u',
					createdAt: new Date('2026-01-01T00:00:00.000Z'),
				},
			]);

			const res = await GET(new Request('http://localhost/api/session/s1/documents'), {
				params: Promise.resolve({ id: 's1' }),
			});

			expect(res.status).toBe(200);
			expect(await res.json()).toEqual([
				{
					documentId: 'd1',
					name: 'a.pdf',
					chunkCount: 0,
					createdAt: '2026-01-01T00:00:00.000Z',
					chunkingStrategy: 'RECURSIVE',
				},
			]);
		});
	});

	describe('POST (attach)', () => {
		const post = (body: unknown) =>
			new Request('http://localhost/api/session/s1/documents', {
				method: 'POST',
				body: JSON.stringify(body),
				headers: { 'Content-Type': 'application/json' },
			});

		it('returns 400 when documentId missing', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });

			const res = await POST(post({}), { params: Promise.resolve({ id: 's1' }) });

			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'missing_document_id' });
		});

		it('returns 404 when document not owned', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
			mockChatSessionRepo.findById.mockResolvedValueOnce(session());
			mockDocumentRepo.findById.mockResolvedValueOnce(null);

			const res = await POST(post({ documentId: 'd1' }), { params: Promise.resolve({ id: 's1' }) });

			expect(res.status).toBe(404);
			expect(await res.json()).toEqual({ error: 'document_not_found' });
		});

		it('returns 403 when attached limit reached', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
			mockChatSessionRepo.findById.mockResolvedValueOnce(session());
			mockDocumentRepo.findById.mockResolvedValueOnce({ id: 'd1', userId: 'u', name: 'd' });
			mockDocumentRepo.countAttached.mockResolvedValueOnce(10);
			mockSessionService.validateAttachedLimit.mockRejectedValueOnce(AttachedLimitReached());

			const res = await POST(post({ documentId: 'd1' }), { params: Promise.resolve({ id: 's1' }) });

			expect(res.status).toBe(403);
			expect(await res.json()).toEqual({ error: 'attached_limit_reached' });
			expect(mockDocumentRepo.attachToSession).not.toHaveBeenCalled();
		});

		it('attaches and returns 204', async () => {
			mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
			mockChatSessionRepo.findById.mockResolvedValueOnce(session());
			mockDocumentRepo.findById.mockResolvedValueOnce({ id: 'd1', userId: 'u', name: 'd' });
			mockDocumentRepo.countAttached.mockResolvedValueOnce(2);
			mockSessionService.validateAttachedLimit.mockResolvedValueOnce(undefined);
			mockDocumentRepo.attachToSession.mockResolvedValueOnce(undefined);

			const res = await POST(post({ documentId: 'd1' }), { params: Promise.resolve({ id: 's1' }) });

			expect(res.status).toBe(204);
			expect(mockDocumentRepo.attachToSession).toHaveBeenCalledWith('s1', 'd1');
		});
	});
});
