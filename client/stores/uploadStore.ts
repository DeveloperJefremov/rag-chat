'use client';
import { create } from 'zustand';
import { IngestResponseDto } from '../../shared/dtos/IngestResponseDto';
import { ChunkingStrategy } from '../../domain/value-objects/ChunkingStrategy';
import { ingestionClientService } from '../infrastructure/container';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadState {
	status: UploadStatus;
	documents: IngestResponseDto[];
	lastDocument: IngestResponseDto | null;
	error: string | null;
	reset: () => void;
	upload: (
		file: File,
		sessionId: string,
		chunkingStrategy?: ChunkingStrategy,
	) => Promise<IngestResponseDto | null>;
}

export const useUploadStore = create<UploadState>((set, get) => ({
	status: 'idle',
	documents: [],
	lastDocument: null,
	error: null,

	reset: () => set({ status: 'idle', error: null, lastDocument: null }),

	upload: async (file, sessionId, chunkingStrategy) => {
		set({ status: 'uploading', error: null });
		try {
			const document = await ingestionClientService.upload({ file, sessionId, chunkingStrategy });
			set({ status: 'success', lastDocument: document, documents: [...get().documents, document] });
			return document;
		} catch (e: unknown) {
			set({ status: 'error', error: e instanceof Error ? e.message : 'upload_failed' });
			return null;
		}
	},
}));
