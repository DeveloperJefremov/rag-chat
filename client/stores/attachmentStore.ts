'use client';
import { create } from 'zustand';
import { IngestResponseDto } from '../../shared/dtos/IngestResponseDto';
import { ingestionApi } from '../infrastructure/container';
import { UnauthenticatedError } from '../infrastructure/http/apiFetch';
import { toast } from './toastStore';

interface AttachmentState {
	attachedBySession: Record<string, IngestResponseDto[]>;
	activeBySession: Record<string, Set<string>>;
	loadedSessions: Set<string>;
	error: string | null;

	loadAttached: (sessionId: string) => Promise<void>;
	attach: (sessionId: string, doc: IngestResponseDto) => Promise<void>;
	detach: (sessionId: string, documentId: string) => Promise<void>;
	toggleActive: (sessionId: string, documentId: string) => void;
	setAllActive: (sessionId: string) => void;
	clearForSession: (sessionId: string) => void;
}

export const useAttachmentStore = create<AttachmentState>((set, get) => ({
	attachedBySession: {},
	activeBySession: {},
	loadedSessions: new Set(),
	error: null,

	loadAttached: async (sessionId: string) => {
		try {
			const docs = await ingestionApi.getAttached(sessionId);
			set(state => ({
				attachedBySession: { ...state.attachedBySession, [sessionId]: docs },
				activeBySession: {
					...state.activeBySession,
					[sessionId]: new Set(docs.map(d => d.documentId)),
				},
				loadedSessions: new Set([...state.loadedSessions, sessionId]),
			}));
		} catch (e: unknown) {
			if (e instanceof UnauthenticatedError) return;
			const msg = e instanceof Error ? e.message : 'attached_fetch_failed';
			toast.error('Could not load attached documents', msg);
			set({ error: msg });
		}
	},

	attach: async (sessionId, doc) => {
		try {
			await ingestionApi.attachToSession(sessionId, doc.documentId);
			set(state => {
				const existing = state.attachedBySession[sessionId] ?? [];
				if (existing.some(d => d.documentId === doc.documentId)) return state;
				const newActive = new Set(state.activeBySession[sessionId] ?? []);
				newActive.add(doc.documentId);
				return {
					attachedBySession: {
						...state.attachedBySession,
						[sessionId]: [doc, ...existing],
					},
					activeBySession: { ...state.activeBySession, [sessionId]: newActive },
				};
			});
		} catch (e: unknown) {
			if (e instanceof UnauthenticatedError) return;
			const msg = e instanceof Error ? e.message : 'attach_failed';
			toast.error('Could not attach document', msg);
			set({ error: msg });
		}
	},

	detach: async (sessionId, documentId) => {
		try {
			await ingestionApi.detachFromSession(sessionId, documentId);
			set(state => {
				const existing = state.attachedBySession[sessionId] ?? [];
				const newActive = new Set(state.activeBySession[sessionId] ?? []);
				newActive.delete(documentId);
				return {
					attachedBySession: {
						...state.attachedBySession,
						[sessionId]: existing.filter(d => d.documentId !== documentId),
					},
					activeBySession: { ...state.activeBySession, [sessionId]: newActive },
				};
			});
		} catch (e: unknown) {
			if (e instanceof UnauthenticatedError) return;
			const msg = e instanceof Error ? e.message : 'detach_failed';
			toast.error('Could not detach document', msg);
			set({ error: msg });
		}
	},

	toggleActive: (sessionId, documentId) => {
		set(state => {
			const current = new Set(state.activeBySession[sessionId] ?? []);
			if (current.has(documentId)) current.delete(documentId);
			else current.add(documentId);
			return { activeBySession: { ...state.activeBySession, [sessionId]: current } };
		});
	},

	setAllActive: (sessionId: string) => {
		const docs = get().attachedBySession[sessionId] ?? [];
		set(state => ({
			activeBySession: {
				...state.activeBySession,
				[sessionId]: new Set(docs.map(d => d.documentId)),
			},
		}));
	},

	clearForSession: (sessionId: string) => {
		set(state => {
			const attached = { ...state.attachedBySession };
			const active = { ...state.activeBySession };
			delete attached[sessionId];
			delete active[sessionId];
			return { attachedBySession: attached, activeBySession: active };
		});
	},
}));
