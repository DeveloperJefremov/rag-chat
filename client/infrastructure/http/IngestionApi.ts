import { IIngestionApi, IngestParams } from '../../application/api/IIngestionApi';
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';

export class IngestionApi implements IIngestionApi {
	async ingest({ file, sessionId, chunkingStrategy }: IngestParams): Promise<IngestResponseDto> {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('sessionId', sessionId);
		if (chunkingStrategy) formData.append('chunkingStrategy', chunkingStrategy);

		const res = await fetch('/api/ingest', { method: 'POST', body: formData });
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: 'upload_failed' }));
			throw new Error(err.error ?? 'upload_failed');
		}
		return res.json();
	}

	async getDocuments(sessionId: string): Promise<IngestResponseDto[]> {
		const res = await fetch(`/api/documents?sessionId=${encodeURIComponent(sessionId)}`);
		if (!res.ok) throw new Error('documents_fetch_failed');
		return res.json();
	}
}
