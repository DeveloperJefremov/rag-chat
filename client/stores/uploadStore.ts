'use client';
import { create } from 'zustand';
import { IngestResponseDto } from '../../shared/dtos/IngestResponseDto';
import { ChunkingStrategy } from '../../domain/value-objects/ChunkingStrategy';
import { ingestionClientService, ingestionApi } from '../infrastructure/container';
import { UnauthenticatedError } from '../infrastructure/http/apiFetch';
import { toast } from './toastStore';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadOptions {
	chunkingStrategy?: ChunkingStrategy;
	attachToSession?: string;
}

interface UploadState {
	status: UploadStatus;
	documents: IngestResponseDto[];
	loaded: boolean;
	lastDocument: IngestResponseDto | null;
	error: string | null;
	reset: () => void;
	fetchDocuments: () => Promise<void>;
	upload: (file: File, options?: UploadOptions) => Promise<IngestResponseDto | null>;
	removeDocument: (id: string) => Promise<void>;
}

export const useUploadStore = create<UploadState>((set, get) => ({
	status: 'idle',
	documents: [],
	loaded: false,
	lastDocument: null,
	error: null,

	reset: () =>
		set({ status: 'idle', error: null, lastDocument: null, documents: [], loaded: false }),

	fetchDocuments: async () => {
		try {
			const documents = await ingestionApi.getDocuments();
			set({ documents, loaded: true });
		} catch (e: unknown) {
			if (e instanceof UnauthenticatedError) return;
			const msg = e instanceof Error ? e.message : 'documents_fetch_failed';
			toast.error('Could not load documents', msg);
			set({ error: msg });
		}
	},

	upload: async (file, options) => {
		set({ status: 'uploading', error: null });
		try {
			const document = await ingestionClientService.upload({
				file,
				chunkingStrategy: options?.chunkingStrategy,
				attachToSession: options?.attachToSession,
			});
			set({
				status: 'success',
				lastDocument: document,
				documents: [document, ...get().documents],
			});
			toast.success('Uploaded', `${document.chunkCount} chunks indexed.`);
			return document;
		} catch (e: unknown) {
			if (e instanceof UnauthenticatedError) {
				set({ status: 'error', error: 'unauthenticated' });
				return null;
			}
			const msg = e instanceof Error ? e.message : 'upload_failed';
			toast.error('Upload failed', msg);
			set({ status: 'error', error: msg });
			return null;
		}
	},

	removeDocument: async (id: string) => {
		try {
			await ingestionApi.deleteDocument(id);
			set({ documents: get().documents.filter(d => d.documentId !== id) });
		} catch (e: unknown) {
			if (e instanceof UnauthenticatedError) return;
			const msg = e instanceof Error ? e.message : 'document_delete_failed';
			toast.error('Could not delete document', msg);
			set({ error: msg });
		}
	},
}));
