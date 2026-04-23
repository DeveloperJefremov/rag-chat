'use client';
import { useState } from 'react';
import { useSessionStore } from '@/client/stores/sessionStore';
import { useUploadStore } from '@/client/stores/uploadStore';
import { FileDropzone } from '@/presentation/web/components/FileDropzone';
import { UploadProgress } from '@/presentation/web/components/UploadProgress';
import { DocumentTable } from './DocumentTable';
import { IngestionSettings } from './IngestionSettings';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';

export function DocumentsPage() {
	const { sessions, activeSessionId, createSession } = useSessionStore();
	const { documents, status, error, upload } = useUploadStore();
	const [settings, setSettings] = useState({
		strategy: 'RECURSIVE' as ChunkingStrategy,
		chunkSize: 512,
		overlap: 50,
	});

	const handleFile = async (file: File) => {
		// Ensure we have a session
		let sessionId = activeSessionId ?? sessions[0]?.id;
		if (!sessionId) {
			const newSession = await createSession();
			sessionId = newSession.id;
		}

		await upload(file, sessionId, settings.strategy);
	};

	const lastDoc = documents[documents.length - 1];

	return (
		<div className='max-w-3xl space-y-6 p-6'>
			<div>
				<h2 className='text-xl font-semibold'>Documents</h2>
				<p className='text-muted-foreground mt-0.5 text-sm'>Upload and index your knowledge base</p>
			</div>

			<IngestionSettings value={settings} onChange={setSettings} />

			<FileDropzone onFile={handleFile} disabled={status === 'uploading'} />

			<UploadProgress
				status={status}
				error={error}
				fileName={lastDoc?.name}
				chunkCount={lastDoc?.chunkCount}
			/>

			<div>
				<h3 className='mb-3 text-sm font-medium'>Indexed Documents ({documents.length})</h3>
				<DocumentTable documents={documents} />
			</div>
		</div>
	);
}
