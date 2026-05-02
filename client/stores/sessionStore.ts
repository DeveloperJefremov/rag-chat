'use client';
import { create } from 'zustand';
import { SessionDto } from '../../shared/dtos/SessionDto';
import { sessionApi } from '../infrastructure/container';
import { UnauthenticatedError } from '../infrastructure/http/apiFetch';
import { toast } from './toastStore';
import { useChatStore } from './chatStore';
import { useAttachmentStore } from './attachmentStore';

function isAuthRedirect(e: unknown): boolean {
	return e instanceof UnauthenticatedError;
}

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
			if (isAuthRedirect(e)) {
				set({ isLoading: false });
				return;
			}
			const msg = e instanceof Error ? e.message : 'unknown_error';
			toast.error('Could not load chats', msg);
			set({ error: msg, isLoading: false });
		}
	},

	createSession: async () => {
		try {
			const session = await sessionApi.createSession();
			useChatStore.getState().reset();
			set(state => ({ sessions: [session, ...state.sessions], activeSessionId: session.id }));
			return session;
		} catch (e: unknown) {
			if (!isAuthRedirect(e)) {
				toast.error('Could not create chat', e instanceof Error ? e.message : undefined);
			}
			throw e;
		}
	},

	deleteSession: async (id: string) => {
		try {
			await sessionApi.deleteSession(id);
		} catch (e: unknown) {
			if (!isAuthRedirect(e)) {
				toast.error('Could not delete chat', e instanceof Error ? e.message : undefined);
			}
			throw e;
		}
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
