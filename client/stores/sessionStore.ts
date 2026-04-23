'use client';
import { create } from 'zustand';
import { SessionDto } from '../../shared/dtos/SessionDto';
import { sessionApi } from '../infrastructure/container';

interface SessionState {
	sessions: SessionDto[];
	activeSessionId: string | null;
	isLoading: boolean;
	error: string | null;
	fetchSessions: () => Promise<void>;
	createSession: () => Promise<SessionDto>;
	setActiveSession: (id: string) => void;
}

export const useSessionStore = create<SessionState>(set => ({
	sessions: [],
	activeSessionId: null,
	isLoading: false,
	error: null,

	fetchSessions: async () => {
		set({ isLoading: true, error: null });
		try {
			const sessions = await sessionApi.getSessions();
			set({ sessions, isLoading: false });
		} catch (e: unknown) {
			set({ error: e instanceof Error ? e.message : 'unknown_error', isLoading: false });
		}
	},

	createSession: async () => {
		const session = await sessionApi.createSession();
		set(state => ({ sessions: [session, ...state.sessions], activeSessionId: session.id }));
		return session;
	},

	setActiveSession: (id: string) => set({ activeSessionId: id }),
}));
