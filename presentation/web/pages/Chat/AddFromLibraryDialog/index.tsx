'use client';
import { useEffect, useState } from 'react';
import { useUploadStore } from '@/client/stores/uploadStore';
import { useAttachmentStore } from '@/client/stores/attachmentStore';
import { Button } from '@/presentation/components/ui/button';

interface Props {
	sessionId: string;
	open: boolean;
	onClose: () => void;
}

export function AddFromLibraryDialog({ sessionId, open, onClose }: Props) {
	const { documents, loaded, fetchDocuments } = useUploadStore();
	const { attachedBySession, attach } = useAttachmentStore();
	const attachedIds = new Set((attachedBySession[sessionId] ?? []).map(d => d.documentId));
	const [busyId, setBusyId] = useState<string | null>(null);

	useEffect(() => {
		if (open && !loaded) void fetchDocuments();
	}, [open, loaded, fetchDocuments]);

	if (!open) return null;

	const handleAttach = async (id: string) => {
		const doc = documents.find(d => d.documentId === id);
		if (!doc) return;
		setBusyId(id);
		try {
			await attach(sessionId, doc);
		} finally {
			setBusyId(null);
		}
	};

	return (
		<div
			className='bg-cobalt-950/40 fixed inset-0 z-50 flex items-center justify-center p-4'
			onClick={onClose}
		>
			<div
				className='border-powder-200 bg-paper w-[min(420px,calc(100vw-32px))] rounded-lg border p-4 shadow-[0_12px_32px_rgba(0,0,0,0.18)]'
				onClick={e => e.stopPropagation()}
			>
				<div className='mb-3 flex items-center justify-between'>
					<h3 className='text-cobalt-900 text-sm font-semibold'>Add from library</h3>
					<Button
						type='button'
						variant='ghost'
						onClick={onClose}
						className='text-smoke hover:text-cobalt-800 h-auto cursor-pointer rounded-none border-none bg-transparent p-0 text-xs font-normal hover:bg-transparent'
					>
						Close
					</Button>
				</div>
				{documents.length === 0 ? (
					<p className='text-smoke py-6 text-center text-xs'>No documents in your library yet.</p>
				) : (
					<ul className='max-h-[60vh] space-y-1 overflow-y-auto'>
						{documents.map(d => {
							const already = attachedIds.has(d.documentId);
							return (
								<li
									key={d.documentId}
									className='hover:bg-sand text-cobalt-900 flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs'
								>
									<span className='truncate'>{d.name}</span>
									<Button
										type='button'
										variant='ghost'
										disabled={already || busyId === d.documentId}
										onClick={() => handleAttach(d.documentId)}
										className='text-cobalt-700 hover:text-cobalt-700 disabled:text-smoke h-auto cursor-pointer rounded-none border-none bg-transparent p-0 text-xs font-normal hover:bg-transparent disabled:cursor-default disabled:opacity-100'
									>
										{already ? 'Attached' : busyId === d.documentId ? '…' : 'Attach'}
									</Button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
