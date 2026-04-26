'use client';
import { useEffect, useState } from 'react';
import { useUploadStore } from '@/client/stores/uploadStore';
import { useAttachmentStore } from '@/client/stores/attachmentStore';

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
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'
			onClick={onClose}
		>
			<div
				className='bg-background w-[420px] max-w-[92vw] rounded-md border p-4 shadow-lg'
				onClick={e => e.stopPropagation()}
			>
				<div className='mb-3 flex items-center justify-between'>
					<h3 className='text-sm font-semibold'>Add from library</h3>
					<button onClick={onClose} className='text-muted-foreground hover:text-foreground text-xs'>
						Close
					</button>
				</div>
				{documents.length === 0 ? (
					<p className='text-muted-foreground py-6 text-center text-xs'>
						No documents in your library yet.
					</p>
				) : (
					<ul className='max-h-[60vh] space-y-1 overflow-auto'>
						{documents.map(d => {
							const already = attachedIds.has(d.documentId);
							return (
								<li
									key={d.documentId}
									className='hover:bg-muted flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs'
								>
									<span className='truncate'>{d.name}</span>
									<button
										disabled={already || busyId === d.documentId}
										onClick={() => handleAttach(d.documentId)}
										className='text-primary disabled:text-muted-foreground cursor-pointer disabled:cursor-default'
									>
										{already ? 'Attached' : busyId === d.documentId ? '…' : 'Attach'}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
