import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuthContext, mockDocumentRepo } = vi.hoisted(() => ({
	mockAuthContext: { requireUser: vi.fn(), requireAdmin: vi.fn(), getUser: vi.fn() },
	mockDocumentRepo: { findById: vi.fn(), deleteById: vi.fn() },
}));

vi.mock('@/server/infrastructure/http/container', () => ({
	authContext: mockAuthContext,
	documentRepo: mockDocumentRepo,
}));

import { DELETE } from '../route';

const makeReq = () => new Request('http://localhost/api/documents/abc', { method: 'DELETE' });

describe('DELETE /api/documents/[id]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 when unauthenticated', async () => {
		const { Unauthenticated } = await import('@/shared/errors/AppError');
		mockAuthContext.requireUser.mockRejectedValueOnce(Unauthenticated());

		const res = await DELETE(makeReq(), { params: Promise.resolve({ id: 'abc' }) });

		expect(res.status).toBe(401);
	});

	it('returns 404 when document not owned', async () => {
		mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
		mockDocumentRepo.findById.mockResolvedValueOnce(null);

		const res = await DELETE(makeReq(), { params: Promise.resolve({ id: 'abc' }) });

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'not_found' });
		expect(mockDocumentRepo.findById).toHaveBeenCalledWith('abc', 'u');
		expect(mockDocumentRepo.deleteById).not.toHaveBeenCalled();
	});

	it('deletes document and returns 204 when owned', async () => {
		mockAuthContext.requireUser.mockResolvedValueOnce({ id: 'u', email: 'e', role: 'USER' });
		mockDocumentRepo.findById.mockResolvedValueOnce({ id: 'abc', userId: 'u', name: 'd' });
		mockDocumentRepo.deleteById.mockResolvedValueOnce(undefined);

		const res = await DELETE(makeReq(), { params: Promise.resolve({ id: 'abc' }) });

		expect(res.status).toBe(204);
		expect(mockDocumentRepo.deleteById).toHaveBeenCalledWith('abc', 'u');
	});
});
