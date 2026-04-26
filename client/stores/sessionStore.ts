'use client';
import { create } from 'zustand';
import { SessionDto } from '../../shared/dtos/SessionDto';
import { sessionApi } from '../infrastructure/container';
import { useChatStore } from './chatStore';
import { useAttachmentStore } from './attachmentStore';

interface SessionState {
	sessions: SessionDto[];
	activeSessionId: string | null;
	isLoading: boolean;
	error: string | null;
	fetchSessions: () => Promise<void>;
	createSession: () => Promise<SessionDto>;
	deleteSession: (id: string) => Promise<void>;
	setActiveSession: (id: string) => void;
	updateSessionTitle: (id: string, title: string) => void;
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
			set(state => {
				const activeSessionId = state.activeSessionId ?? sessions[0]?.id ?? null;
				if (activeSessionId) {
					void useAttachmentStore.getState().loadAttached(activeSessionId);
					void useChatStore.getState().loadHistory(activeSessionId);
				}
				return { sessions, isLoading: false, activeSessionId };
			});
		} catch (e: unknown) {
			set({ error: e instanceof Error ? e.message : 'unknown_error', isLoading: false });
		}
	},

	createSession: async () => {
		const session = await sessionApi.createSession();
		useChatStore.getState().reset();
		set(state => ({ sessions: [session, ...state.sessions], activeSessionId: session.id }));
		return session;
	},

	deleteSession: async (id: string) => {
		await sessionApi.deleteSession(id);
		set(state => {
			const sessions = state.sessions.filter(s => s.id !== id);
			const wasActive = state.activeSessionId === id;
			const activeSessionId = wasActive ? (sessions[0]?.id ?? null) : state.activeSessionId;
			if (wasActive) {
				useChatStore.getState().reset();
				useAttachmentStore.getState().clearForSession(id);
				if (activeSessionId) {
					void useAttachmentStore.getState().loadAttached(activeSessionId);
				}
			}
			return { sessions, activeSessionId };
		});
	},

	setActiveSession: (id: string) =>
		set(state => {
			if (state.activeSessionId === id) return state;
			useChatStore.getState().reset();
			void useAttachmentStore.getState().loadAttached(id);
			void useChatStore.getState().loadHistory(id);
			return { activeSessionId: id };
		}),

	updateSessionTitle: (id: string, title: string) =>
		set(state => ({
			sessions: state.sessions.map(s => (s.id === id ? { ...s, title } : s)),
		})),
}));
