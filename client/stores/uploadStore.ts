'use client';
import { create } from 'zustand';
import { IngestResponseDto } from '../../shared/dtos/IngestResponseDto';
import { ChunkingStrategy } from '../../domain/value-objects/ChunkingStrategy';
import { ingestionClientService, ingestionApi } from '../infrastructure/container';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadState {
	status: UploadStatus;
	documents: IngestResponseDto[];
	loadedSessionId: string | null;
	lastDocument: IngestResponseDto | null;
	error: string | null;
	reset: () => void;
	fetchDocuments: (sessionId: string) => Promise<void>;
	upload: (
		file: File,
		sessionId: string,
		chunkingStrategy?: ChunkingStrategy,
	) => Promise<IngestResponseDto | null>;
}

export const useUploadStore = create<UploadState>((set, get) => ({
	status: 'idle',
	documents: [],
	loadedSessionId: null,
	lastDocument: null,
	error: null,

	reset: () =>
		set({ status: 'idle', error: null, lastDocument: null, documents: [], loadedSessionId: null }),

	fetchDocuments: async (sessionId: string) => {
		try {
			const documents = await ingestionApi.getDocuments(sessionId);
			set({ documents, loadedSessionId: sessionId });
		} catch (e: unknown) {
			set({ error: e instanceof Error ? e.message : 'documents_fetch_failed' });
		}
	},

	upload: async (file, sessionId, chunkingStrategy) => {
		set({ status: 'uploading', error: null });
		try {
			const document = await ingestionClientService.upload({ file, sessionId, chunkingStrategy });
			const current = get().loadedSessionId === sessionId ? get().documents : [];
			set({
				status: 'success',
				lastDocument: document,
				documents: [document, ...current],
				loadedSessionId: sessionId,
			});
			return document;
		} catch (e: unknown) {
			set({ status: 'error', error: e instanceof Error ? e.message : 'upload_failed' });
			return null;
		}
	},
}));
