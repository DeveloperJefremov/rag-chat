'use client';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { useUploadStore } from '@/client/stores/uploadStore';

interface KnowledgePanelProps {
	activeDocumentId: string | null;
	onSelectDocument: (id: string) => void;
}

export function KnowledgePanel({ activeDocumentId, onSelectDocument }: KnowledgePanelProps) {
	const { documents } = useUploadStore();

	return (
		<div className='bg-muted/10 flex w-52 shrink-0 flex-col border-r'>
			<div className='flex items-center justify-between border-b px-3 py-3'>
				<span className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
					Knowledge
				</span>
				<Link href='/documents' className='text-muted-foreground hover:text-foreground'>
					<Plus className='h-3.5 w-3.5' />
				</Link>
			</div>

			<div className='flex-1 space-y-0.5 overflow-auto p-2'>
				{documents.length === 0 && (
					<p className='text-muted-foreground px-2 py-2 text-xs'>
						No documents yet.{' '}
						<Link href='/documents' className='underline'>
							Upload one
						</Link>
					</p>
				)}
				{documents.map(doc => (
					<button
						key={doc.documentId}
						onClick={() => onSelectDocument(doc.documentId)}
						className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
							activeDocumentId === doc.documentId
								? 'bg-primary/10 text-primary border-primary/20 border'
								: 'text-muted-foreground hover:bg-muted hover:text-foreground'
						}`}
					>
						<FileText className='h-3 w-3 shrink-0' />
						<span className='truncate'>{doc.name}</span>
					</button>
				))}
			</div>
		</div>
	);
}
