import { IIngestionApi, IngestParams } from '../../application/api/IIngestionApi';
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';
import { apiFetch } from './apiFetch';

export class IngestionApi implements IIngestionApi {
	async ingest({
		file,
		chunkingStrategy,
		attachToSession,
	}: IngestParams): Promise<IngestResponseDto> {
		const formData = new FormData();
		formData.append('file', file);
		if (chunkingStrategy) formData.append('chunkingStrategy', chunkingStrategy);
		if (attachToSession) formData.append('attachToSession', attachToSession);

		const res = await apiFetch('/api/ingest', { method: 'POST', body: formData });
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'upload_failed' }));
			throw new Error(err.error ?? 'upload_failed');
		}
		return res.json();
	}

	async getDocuments(): Promise<IngestResponseDto[]> {
		const res = await apiFetch('/api/documents');
		if (!res.ok) throw new Error('documents_fetch_failed');
		return res.json();
	}

	async deleteDocument(id: string): Promise<void> {
		const res = await apiFetch(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('document_delete_failed');
	}

	async getAttached(sessionId: string): Promise<IngestResponseDto[]> {
		const res = await apiFetch(`/api/session/${encodeURIComponent(sessionId)}/documents`);
		if (!res.ok) throw new Error('attached_fetch_failed');
		return res.json();
	}

	async attachToSession(sessionId: string, documentId: string): Promise<void> {
		const res = await apiFetch(`/api/session/${encodeURIComponent(sessionId)}/documents`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ documentId }),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'attach_failed' }));
			throw new Error(err.error ?? 'attach_failed');
		}
	}

	async detachFromSession(sessionId: string, documentId: string): Promise<void> {
		const res = await apiFetch(
			`/api/session/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(documentId)}`,
			{ method: 'DELETE' },
		);
		if (!res.ok) throw new Error('detach_failed');
	}
}
