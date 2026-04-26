'use client';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { useAttachmentStore } from '@/client/stores/attachmentStore';

interface KnowledgePanelProps {
	sessionId: string | null;
	activeIds: Set<string>;
	onToggle: (id: string) => void;
}

export function KnowledgePanel({ sessionId, activeIds, onToggle }: KnowledgePanelProps) {
	const { attachedBySession } = useAttachmentStore();
	const docs = sessionId ? (attachedBySession[sessionId] ?? []) : [];

	return (
		<div className='bg-muted/10 flex w-52 shrink-0 flex-col border-r'>
			<div className='flex items-center justify-between border-b px-3 py-3'>
				<span className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
					Attached
				</span>
				<Link href='/documents' className='text-muted-foreground hover:text-foreground'>
					<Plus className='h-3.5 w-3.5' />
				</Link>
			</div>

			<div className='flex-1 space-y-0.5 overflow-auto p-2'>
				{docs.length === 0 && (
					<p className='text-muted-foreground px-2 py-2 text-xs'>
						No documents attached.{' '}
						<Link href='/documents' className='underline'>
							Library
						</Link>
					</p>
				)}
				{docs.map(doc => {
					const isActive = activeIds.has(doc.documentId);
					return (
						<button
							key={doc.documentId}
							onClick={() => onToggle(doc.documentId)}
							className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
								isActive
									? 'bg-primary/10 text-primary border-primary/20 border'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground'
							}`}
						>
							<FileText className='h-3 w-3 shrink-0' />
							<span className='truncate'>{doc.name}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
