'use client';
import { create } from 'zustand';
import { MessageDto } from '../../shared/dtos/MessageDto';
import { CitationDto } from '../../shared/dtos/CitationDto';
import { ChunkingStrategy } from '../../domain/value-objects/ChunkingStrategy';
import { chatSessionService } from '../infrastructure/container';
import { useSessionStore } from './sessionStore';

interface SendMessageParams {
	message: string;
	sessionId: string;
	documentId: string;
	chunkingStrategy?: ChunkingStrategy;
	topK?: number;
	rerankingEnabled?: boolean;
}

interface ChatState {
	messages: MessageDto[];
	citationsByMessageId: Record<string, CitationDto[]>;
	isStreaming: boolean;
	isLoadingHistory: boolean;
	error: string | null;
	sendMessage: (params: SendMessageParams) => Promise<void>;
	loadHistory: (sessionId: string) => Promise<void>;
	reset: () => void;
}

export const useChatStore = create<ChatState>(set => ({
	messages: [],
	citationsByMessageId: {},
	isStreaming: false,
	isLoadingHistory: false,
	error: null,

	reset: () =>
		set({
			messages: [],
			citationsByMessageId: {},
			error: null,
			isStreaming: false,
			isLoadingHistory: false,
		}),

	loadHistory: async (sessionId: string) => {
		set({ isLoadingHistory: true, error: null });
		try {
			const messages = await chatSessionService.loadHistory(sessionId);
			const citationsByMessageId: Record<string, CitationDto[]> = {};
			for (const m of messages) {
				if (m.citations && m.citations.length > 0) {
					citationsByMessageId[m.id] = m.citations;
				}
			}
			const stripped: MessageDto[] = messages.map(m => ({
				id: m.id,
				role: m.role,
				content: m.content,
				createdAt: m.createdAt,
			}));
			set({ messages: stripped, citationsByMessageId, isLoadingHistory: false });
		} catch (e: unknown) {
			set({
				error: e instanceof Error ? e.message : 'history_load_failed',
				isLoadingHistory: false,
			});
		}
	},

	sendMessage: async params => {
		set({ isStreaming: true, error: null });

		let currentAssistantId: string | null = null;

		await chatSessionService.send(params, {
			onUserMessage: msg => {
				set(state => ({ messages: [...state.messages, msg] }));
			},
			onAssistantStart: msg => {
				currentAssistantId = msg.id;
				set(state => ({ messages: [...state.messages, msg] }));
			},
			onSources: sources => {
				if (!currentAssistantId) return;
				set(state => ({
					citationsByMessageId: {
						...state.citationsByMessageId,
						[currentAssistantId!]: sources,
					},
				}));
			},
			onChunk: text => {
				set(state => {
					const msgs = [...state.messages];
					const last = msgs[msgs.length - 1];
					if (last && last.role === 'ASSISTANT') {
						msgs[msgs.length - 1] = { ...last, content: last.content + text };
					}
					return { messages: msgs };
				});
			},
			onTitle: (sessionId, title) => {
				useSessionStore.getState().updateSessionTitle(sessionId, title);
			},
			onError: error => {
				set(state => {
					const msgs = [...state.messages];
					const last = msgs[msgs.length - 1];
					if (last && last.role === 'ASSISTANT' && last.content === '') {
						msgs[msgs.length - 1] = { ...last, content: `⚠ ${error}` };
					}
					return { messages: msgs, error, isStreaming: false };
				});
			},
			onDone: () => set({ isStreaming: false }),
		});
	},
}));
