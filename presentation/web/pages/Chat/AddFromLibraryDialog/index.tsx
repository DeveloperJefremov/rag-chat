'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUploadStore } from '@/client/stores/uploadStore';
import { useAttachmentStore } from '@/client/stores/attachmentStore';
import { BrandButton } from '@/presentation/web/components/ui/BrandButton';
import { BrandInput } from '@/presentation/web/components/ui/BrandInput';
import { IconButton } from '@/presentation/web/components/ui/IconButton';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

interface Props {
	sessionId: string;
	open: boolean;
	onClose: () => void;
}

type FileKind = 'pdf' | 'md' | 'txt' | 'docx';

function fileType(name: string): FileKind {
	const ext = name.split('.').pop()?.toLowerCase();
	if (ext === 'pdf') return 'pdf';
	if (ext === 'docx') return 'docx';
	if (ext === 'md') return 'md';
	return 'txt';
}

function TypeBadge({ type }: { type: FileKind }) {
	return (
		<div
			className={clsx(
				'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md',
				type === 'pdf' ? 'bg-terracotta-600' : 'bg-cobalt-700',
			)}
		>
			<span className='text-paper font-mono text-[9px] font-medium tracking-[0.05em]'>
				{type.toUpperCase()}
			</span>
		</div>
	);
}

function formatRelative(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	if (days === 1) return 'yesterday';
	if (days < 7) return `${days}d ago`;
	return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AddFromLibraryDialog({ sessionId, open, onClose }: Props) {
	const { documents, loaded, fetchDocuments } = useUploadStore();
	const { attachedBySession, attach } = useAttachmentStore();
	const attachedIds = new Set((attachedBySession[sessionId] ?? []).map(d => d.documentId));
	const [busyId, setBusyId] = useState<string | null>(null);
	const [query, setQuery] = useState('');

	const close = useCallback(() => {
		setQuery('');
		onClose();
	}, [onClose]);

	useEffect(() => {
		if (open && !loaded) void fetchDocuments();
	}, [open, loaded, fetchDocuments]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, close]);

	const filtered = useMemo<IngestResponseDto[]>(() => {
		const q = query.trim().toLowerCase();
		if (!q) return documents;
		return documents.filter(d => d.name.toLowerCase().includes(q));
	}, [documents, query]);

	if (!open || typeof document === 'undefined') return null;

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

	const totalCount = documents.length;
	const attachedCount = attachedIds.size;
	const showSearch = totalCount > 5;

	return createPortal(
		<div
			role='dialog'
			aria-modal='true'
			aria-labelledby='library-dialog-title'
			onClick={close}
			className='fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(10,14,26,0.62)] p-6 backdrop-blur-[4px]'
		>
			<div
				onClick={e => e.stopPropagation()}
				className='border-powder-200 bg-paper flex max-h-[min(640px,calc(100vh-48px))] w-full max-w-[520px] animate-[fade-up_0.2s_ease_both] flex-col overflow-hidden rounded-[12px] border shadow-[0_24px_64px_-16px_rgba(10,14,26,0.4)]'
			>
				<header className='border-powder-200 flex items-start justify-between gap-3 border-b px-6 py-5'>
					<div className='min-w-0'>
						<div className='mb-1.5 flex items-center gap-2.5'>
							<div className='bg-cobalt-700 h-2 w-2 flex-shrink-0 rounded-full' />
							<h2
								id='library-dialog-title'
								className='text-cobalt-900 m-0 font-serif text-[20px] font-light tracking-[-0.01em]'
							>
								Add from library
							</h2>
						</div>
						<div className='text-smoke font-mono text-[10px] tracking-[0.12em] uppercase'>
							{totalCount === 0
								? 'Library is empty'
								: `${totalCount} document${totalCount === 1 ? '' : 's'} · ${attachedCount} attached`}
						</div>
					</div>
					<IconButton
						size='sm'
						aria-label='Close'
						onClick={close}
						className='text-smoke hover:text-cobalt-800 -mr-1.5'
					>
						<svg
							width='14'
							height='14'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2'
						>
							<line x1='18' y1='6' x2='6' y2='18' />
							<line x1='6' y1='6' x2='18' y2='18' />
						</svg>
					</IconButton>
				</header>

				{showSearch && (
					<div className='border-powder-200 bg-sand/40 border-b px-6 py-3'>
						<BrandInput
							autoFocus
							placeholder='Search documents…'
							value={query}
							onChange={e => setQuery(e.target.value)}
							className='h-9'
						/>
					</div>
				)}

				<div className='min-h-0 flex-1 overflow-y-auto'>
					{totalCount === 0 ? (
						<div className='flex flex-col items-center justify-center gap-3 px-6 py-12 text-center'>
							<svg
								width='32'
								height='32'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='1.5'
								className='text-powder-400'
							>
								<path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
								<polyline points='14 2 14 8 20 8' />
								<line x1='9' y1='15' x2='15' y2='15' />
							</svg>
							<div className='text-cobalt-800 text-sm font-medium'>Your library is empty</div>
							<p className='text-smoke max-w-[280px] text-xs leading-[1.55]'>
								Upload PDF, TXT, or DOCX files first, then attach them to this chat.
							</p>
							<Link
								href='/documents'
								onClick={close}
								className='text-cobalt-700 hover:text-cobalt-800 mt-1 font-mono text-[11px] tracking-[0.1em] uppercase underline-offset-4 hover:underline'
							>
								Upload documents →
							</Link>
						</div>
					) : filtered.length === 0 ? (
						<div className='px-6 py-10 text-center'>
							<p className='text-smoke font-mono text-[11px] tracking-[0.08em]'>
								No matches for “{query}”
							</p>
						</div>
					) : (
						<ul className='flex flex-col gap-1 p-3'>
							{filtered.map(d => {
								const already = attachedIds.has(d.documentId);
								const busy = busyId === d.documentId;
								const type = fileType(d.name);
								return (
									<li
										key={d.documentId}
										className={clsx(
											'flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors',
											already
												? 'border-cobalt-200 bg-powder-100/60'
												: 'hover:border-powder-300 hover:bg-sand/60 border-transparent',
										)}
									>
										<TypeBadge type={type} />
										<div className='min-w-0 flex-1'>
											<div className='text-cobalt-900 truncate text-[13px] font-medium'>
												{d.name}
											</div>
											<div className='text-smoke mt-0.5 font-mono text-[10px] tracking-[0.06em]'>
												{d.chunkCount} chunks · {formatRelative(d.createdAt)}
											</div>
										</div>
										{already ? (
											<span className='text-cobalt-700 inline-flex flex-shrink-0 items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase'>
												<svg
													width='12'
													height='12'
													viewBox='0 0 24 24'
													fill='none'
													stroke='currentColor'
													strokeWidth='2.5'
												>
													<polyline points='20 6 9 17 4 12' />
												</svg>
												Attached
											</span>
										) : (
											<BrandButton
												tone='primary'
												disabled={busy}
												onClick={() => handleAttach(d.documentId)}
												className='flex-shrink-0 px-3 py-1.5 text-[10px]'
											>
												{busy ? '…' : 'Attach'}
											</BrandButton>
										)}
									</li>
								);
							})}
						</ul>
					)}
				</div>

				{totalCount > 0 && (
					<footer className='border-powder-200 bg-sand/40 flex items-center justify-between gap-3 border-t px-6 py-3'>
						<Link
							href='/documents'
							onClick={close}
							className='text-smoke hover:text-cobalt-800 font-mono text-[10px] tracking-[0.12em] uppercase underline-offset-4 hover:underline'
						>
							Manage library →
						</Link>
						<BrandButton tone='outline' onClick={close} className='px-3 py-1.5 text-[10px]'>
							Done
						</BrandButton>
					</footer>
				)}
			</div>
		</div>,
		document.body,
	);
}
