'use client';
import { create } from 'zustand';
import { MessageDto } from '../../shared/dtos/MessageDto';
import { CitationDto } from '../../shared/dtos/CitationDto';
import { ChunkingStrategy } from '../../domain/value-objects/ChunkingStrategy';
import { chatSessionService } from '../infrastructure/container';

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
	error: string | null;
	sendMessage: (params: SendMessageParams) => Promise<void>;
	reset: () => void;
}

export const useChatStore = create<ChatState>(set => ({
	messages: [],
	citationsByMessageId: {},
	isStreaming: false,
	error: null,

	reset: () => set({ messages: [], citationsByMessageId: {}, error: null, isStreaming: false }),

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
			onError: error => set({ error, isStreaming: false }),
			onDone: () => set({ isStreaming: false }),
		});
	},
}));
