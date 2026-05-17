import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSessionApi, mockToast } = vi.hoisted(() => ({
	mockSessionApi: {
		getSessions: vi.fn(),
		createSession: vi.fn(),
		deleteSession: vi.fn(),
	},
	mockToast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('../../infrastructure/container', () => ({
	sessionApi: mockSessionApi,
}));

vi.mock('../toastStore', () => ({
	toast: mockToast,
}));

import { useSessionStore } from '../sessionStore';
import { useChatStore } from '../chatStore';

beforeEach(() => {
	vi.clearAllMocks();
	useSessionStore.setState({
		sessions: [],
		activeSessionId: null,
		isLoading: false,
		error: null,
		hasFetched: false,
	});
});

describe('sessionStore.startNewChat', () => {
	it('does not call sessionApi.createSession', () => {
		useSessionStore.getState().startNewChat();
		expect(mockSessionApi.createSession).not.toHaveBeenCalled();
	});

	it('sets activeSessionId to null', () => {
		useSessionStore.setState({ activeSessionId: 'existing-id' });
		useSessionStore.getState().startNewChat();
		expect(useSessionStore.getState().activeSessionId).toBeNull();
	});

	it('resets chatStore messages', () => {
		useChatStore.setState({
			messages: [
				{
					id: 'm1',
					sessionId: 's1',
					role: 'user',
					content: 'hi',
					createdAt: new Date().toISOString(),
				},
			] as never,
			citationsByMessageId: {},
		});

		useSessionStore.getState().startNewChat();

		expect(useChatStore.getState().messages).toEqual([]);
	});
});

describe('sessionStore.createSession', () => {
	it('shows friendly toast text when server returns chat_sessions_limit_reached', async () => {
		mockSessionApi.createSession.mockRejectedValueOnce(new Error('chat_sessions_limit_reached'));

		await expect(useSessionStore.getState().createSession()).rejects.toThrow(
			'chat_sessions_limit_reached',
		);

		expect(mockToast.error).toHaveBeenCalledOnce();
		const [title, body] = mockToast.error.mock.calls[0];
		expect(title).toBe('Could not create chat');
		expect(body).toMatch(/Chat limit reached/);
		expect(body).toMatch(/10 chats/);
	});

	it('falls back to raw error message for unknown codes', async () => {
		mockSessionApi.createSession.mockRejectedValueOnce(new Error('weird_error'));

		await expect(useSessionStore.getState().createSession()).rejects.toThrow('weird_error');

		const [, body] = mockToast.error.mock.calls[0];
		expect(body).toBe('weird_error');
	});
});

describe('sessionStore.fetchSessions', () => {
	it('auto-selects the latest session on first load', async () => {
		mockSessionApi.getSessions.mockResolvedValueOnce([
			{
				id: 's-newest',
				title: null,
				createdAt: '2026-05-17T00:00:00.000Z',
				expiresAt: '2026-05-18T00:00:00.000Z',
			},
			{
				id: 's-older',
				title: null,
				createdAt: '2026-05-16T00:00:00.000Z',
				expiresAt: '2026-05-17T00:00:00.000Z',
			},
		]);

		await useSessionStore.getState().fetchSessions();

		expect(useSessionStore.getState().activeSessionId).toBe('s-newest');
		expect(useSessionStore.getState().hasFetched).toBe(true);
	});

	it('preserves an explicit draft (activeSessionId=null) on subsequent fetch', async () => {
		// First fetch: populates and auto-selects.
		mockSessionApi.getSessions.mockResolvedValueOnce([
			{
				id: 's-1',
				title: null,
				createdAt: '2026-05-17T00:00:00.000Z',
				expiresAt: '2026-05-18T00:00:00.000Z',
			},
		]);
		await useSessionStore.getState().fetchSessions();
		expect(useSessionStore.getState().activeSessionId).toBe('s-1');

		// User enters draft mode.
		useSessionStore.getState().startNewChat();
		expect(useSessionStore.getState().activeSessionId).toBeNull();

		// Cross-route remount triggers fetchSessions again.
		mockSessionApi.getSessions.mockResolvedValueOnce([
			{
				id: 's-1',
				title: null,
				createdAt: '2026-05-17T00:00:00.000Z',
				expiresAt: '2026-05-18T00:00:00.000Z',
			},
		]);
		await useSessionStore.getState().fetchSessions();

		expect(useSessionStore.getState().activeSessionId).toBeNull();
	});
});
