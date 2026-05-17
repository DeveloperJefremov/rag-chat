import { describe, it, expect, vi } from 'vitest';
import { SessionService } from '../SessionService';
import type { IChatSessionRepository } from '../../repositories/IChatSessionRepository';
import type { IUserUsageRepository } from '../../repositories/IUserUsageRepository';

const makeSession = (overrides = {}) => ({
	id: 'sess-1',
	title: null,
	userId: 'user-1',
	createdAt: new Date(),
	expiresAt: new Date(Date.now() + 86400000),
	...overrides,
});

const makeSessionRepo = (
	overrides: Partial<IChatSessionRepository> = {},
): IChatSessionRepository => ({
	findById: vi.fn(),
	findByUserId: vi.fn(),
	countByUser: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
	deleteExpired: vi.fn(),
	...overrides,
});

const makeUsageRepo = (overrides: Partial<IUserUsageRepository> = {}): IUserUsageRepository => ({
	getTodayCount: vi.fn().mockResolvedValue(0),
	increment: vi.fn().mockResolvedValue(undefined),
	...overrides,
});

describe('SessionService', () => {
	describe('getOrCreate', () => {
		it('creates new session when sessionId is null', async () => {
			const newSession = makeSession({ id: 'new-id' });
			const sessionRepo = makeSessionRepo({ create: vi.fn().mockResolvedValue(newSession) });
			const service = new SessionService(sessionRepo, makeUsageRepo());

			const result = await service.getOrCreate('user-1', null);

			expect(sessionRepo.create).toHaveBeenCalledOnce();
			expect(result.id).toBe('new-id');
		});

		it('returns existing valid session', async () => {
			const existing = makeSession({
				id: 'existing-id',
				expiresAt: new Date(Date.now() + 3600000),
			});
			const sessionRepo = makeSessionRepo({ findById: vi.fn().mockResolvedValue(existing) });
			const service = new SessionService(sessionRepo, makeUsageRepo());

			const result = await service.getOrCreate('user-1', 'existing-id');

			expect(result.id).toBe('existing-id');
		});

		it('creates new session when existing is expired', async () => {
			const expired = makeSession({ id: 'old', expiresAt: new Date(Date.now() - 1000) });
			const fresh = makeSession({ id: 'fresh' });
			const sessionRepo = makeSessionRepo({
				findById: vi.fn().mockResolvedValue(expired),
				create: vi.fn().mockResolvedValue(fresh),
			});
			const service = new SessionService(sessionRepo, makeUsageRepo());

			const result = await service.getOrCreate('user-1', 'old');

			expect(sessionRepo.create).toHaveBeenCalledOnce();
			expect(result.id).toBe('fresh');
		});
	});

	describe('validateLimit', () => {
		it('throws when daily count >= limit for USER role', async () => {
			const usageRepo = makeUsageRepo({ getTodayCount: vi.fn().mockResolvedValue(100) });
			const service = new SessionService(makeSessionRepo(), usageRepo);

			await expect(service.validateLimit('user-1', 'USER')).rejects.toThrow('limit_reached');
		});

		it('does not throw when under limit', async () => {
			const usageRepo = makeUsageRepo({ getTodayCount: vi.fn().mockResolvedValue(50) });
			const service = new SessionService(makeSessionRepo(), usageRepo);

			await expect(service.validateLimit('user-1', 'USER')).resolves.toBeUndefined();
		});

		it('never throws for ADMIN role', async () => {
			const usageRepo = makeUsageRepo({ getTodayCount: vi.fn().mockResolvedValue(99999) });
			const service = new SessionService(makeSessionRepo(), usageRepo);

			await expect(service.validateLimit('admin-1', 'ADMIN')).resolves.toBeUndefined();
		});
	});

	describe('validateDocumentsLimit', () => {
		it('throws when USER reaches maxDocumentsPerUser (20)', async () => {
			const service = new SessionService(makeSessionRepo(), makeUsageRepo());
			await expect(service.validateDocumentsLimit('u', 'USER', 20)).rejects.toThrow(
				'documents_limit_reached',
			);
		});
		it('passes when below limit', async () => {
			const service = new SessionService(makeSessionRepo(), makeUsageRepo());
			await expect(service.validateDocumentsLimit('u', 'USER', 5)).resolves.toBeUndefined();
		});
		it('does not throw for ADMIN', async () => {
			const service = new SessionService(makeSessionRepo(), makeUsageRepo());
			await expect(service.validateDocumentsLimit('u', 'ADMIN', 99999)).resolves.toBeUndefined();
		});
	});

	describe('validateAttachedLimit', () => {
		it('throws when USER reaches maxAttachedPerSession (10)', async () => {
			const service = new SessionService(makeSessionRepo(), makeUsageRepo());
			await expect(service.validateAttachedLimit('USER', 10)).rejects.toThrow(
				'attached_limit_reached',
			);
		});
		it('passes when below limit', async () => {
			const service = new SessionService(makeSessionRepo(), makeUsageRepo());
			await expect(service.validateAttachedLimit('USER', 3)).resolves.toBeUndefined();
		});
	});

	describe('validateChatSessionsLimit', () => {
		it('throws ChatSessionsLimitReached when USER count >= maxChatSessions (10)', async () => {
			const sessionRepo = makeSessionRepo({
				countByUser: vi.fn().mockResolvedValue(10),
			});
			const service = new SessionService(sessionRepo, makeUsageRepo());

			await expect(service.validateChatSessionsLimit('user-1', 'USER')).rejects.toThrow(
				'chat_sessions_limit_reached',
			);
		});

		it('does not throw when USER is below the limit', async () => {
			const sessionRepo = makeSessionRepo({
				countByUser: vi.fn().mockResolvedValue(9),
			});
			const service = new SessionService(sessionRepo, makeUsageRepo());

			await expect(service.validateChatSessionsLimit('user-1', 'USER')).resolves.toBeUndefined();
		});

		it('never throws for ADMIN role and does not call countByUser', async () => {
			const countByUser = vi.fn();
			const sessionRepo = makeSessionRepo({ countByUser });
			const service = new SessionService(sessionRepo, makeUsageRepo());

			await expect(service.validateChatSessionsLimit('admin-1', 'ADMIN')).resolves.toBeUndefined();
			expect(countByUser).not.toHaveBeenCalled();
		});
	});
});
