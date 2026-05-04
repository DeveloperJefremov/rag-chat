import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadProgressProps {
	status: UploadStatus;
	fileName?: string;
	chunkCount?: number;
	error?: string | null;
}

export function UploadProgress({ status, fileName, chunkCount, error }: UploadProgressProps) {
	if (status === 'idle') return null;

	return (
		<div
			className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
				status === 'success'
					? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300'
					: status === 'error'
						? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300'
						: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-300'
			}`}
		>
			{status === 'uploading' && <Loader2 className='mt-0.5 h-4 w-4 shrink-0 animate-spin' />}
			{status === 'success' && <CheckCircle className='mt-0.5 h-4 w-4 shrink-0' />}
			{status === 'error' && <XCircle className='mt-0.5 h-4 w-4 shrink-0' />}

			<div>
				{status === 'uploading' && <p>Uploading and indexing file…</p>}
				{status === 'success' && (
					<>
						<p className='font-medium'>
							{fileName ? `"${fileName}" indexed successfully` : 'File indexed successfully'}
						</p>
						{chunkCount != null && (
							<p className='text-xs opacity-80'>{chunkCount} chunks created</p>
						)}
					</>
				)}
				{status === 'error' && <p>{error ?? 'Upload failed. Please try again.'}</p>}
			</div>
		</div>
	);
}
