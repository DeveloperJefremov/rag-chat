'use client';
import clsx from 'clsx';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';
import { IconButton } from '@/presentation/web/components/ui/IconButton';
import { Skeleton } from '@/presentation/components/ui/skeleton';

interface DocumentTableProps {
	documents: IngestResponseDto[];
	selectedId: string | null;
	onSelect: (doc: IngestResponseDto | null) => void;
	onDelete?: (id: string) => Promise<void> | void;
	loading?: boolean;
	className?: string;
}

function TypeIcon({ type }: { type: 'pdf' | 'md' | 'txt' | 'docx' }) {
	return (
		<div
			className={clsx(
				'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
				type === 'pdf' ? 'bg-terracotta-600' : 'bg-cobalt-700',
			)}
		>
			<span className='text-paper font-mono text-[9px] font-medium tracking-[0.05em]'>
				{type.toUpperCase()}
			</span>
		</div>
	);
}

function fileType(name: string): 'pdf' | 'md' | 'txt' | 'docx' {
	const ext = name.split('.').pop()?.toLowerCase();
	if (ext === 'pdf') return 'pdf';
	if (ext === 'docx') return 'docx';
	if (ext === 'md') return 'md';
	return 'txt';
}

function formatRelative(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'now';
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	if (days === 1) return 'Yesterday';
	if (days < 7) return `${days}d ago`;
	return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function DocumentTable({
	documents,
	selectedId,
	onSelect,
	onDelete,
	loading,
	className,
}: DocumentTableProps) {
	const cols = onDelete ? '2fr 70px 110px 80px 40px' : '2fr 70px 110px 80px';
	const headers = ['Document', 'Chunks', 'Strategy', 'Added'];
	if (onDelete) headers.push('');

	if (loading && documents.length === 0) {
		return (
			<div
				className={clsx('border-powder-200 bg-paper overflow-hidden rounded-lg border', className)}
				aria-busy='true'
				aria-live='polite'
				aria-label='Loading documents'
			>
				<div
					className='bg-sand border-powder-200 grid border-b px-4 py-2.5'
					style={{ gridTemplateColumns: cols }}
				>
					{headers.map((h, i) => (
						<div
							key={`${h}-${i}`}
							className='text-smoke font-mono text-[9px] tracking-[0.15em] uppercase'
						>
							{h}
						</div>
					))}
				</div>
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={i}
						className={clsx('grid items-center px-4 py-3', i < 3 && 'border-powder-200 border-b')}
						style={{ gridTemplateColumns: cols }}
					>
						<div className='flex min-w-0 items-center gap-2.5'>
							<Skeleton className='h-8 w-8 flex-shrink-0 rounded-md' />
							<Skeleton className='h-3 w-3/5' />
						</div>
						<Skeleton className='h-3 w-8' />
						<Skeleton className='h-3 w-16' />
						<Skeleton className='h-3 w-12' />
						{onDelete && <Skeleton className='h-6 w-6 rounded' />}
					</div>
				))}
			</div>
		);
	}

	if (documents.length === 0) {
		return (
			<div
				className={clsx(
					'border-powder-200 bg-paper rounded-lg border px-5 py-10 text-center',
					className,
				)}
			>
				<p className='text-smoke font-mono text-xs'>No documents uploaded yet.</p>
			</div>
		);
	}

	return (
		<div
			className={clsx('border-powder-200 bg-paper overflow-hidden rounded-lg border', className)}
		>
			<div
				className='bg-sand border-powder-200 grid border-b px-4 py-2.5'
				style={{ gridTemplateColumns: cols }}
			>
				{headers.map((h, i) => (
					<div
						key={`${h}-${i}`}
						className='text-smoke font-mono text-[9px] tracking-[0.15em] uppercase'
					>
						{h}
					</div>
				))}
			</div>
			{documents.map((doc, i) => {
				const type = fileType(doc.name);
				const isActive = doc.documentId === selectedId;
				return (
					<div
						key={doc.documentId}
						onClick={() => onSelect(isActive ? null : doc)}
						className={clsx(
							'grid cursor-pointer items-center px-4 py-3 transition-colors',
							i < documents.length - 1 && 'border-powder-200 border-b',
							isActive ? 'bg-powder-100' : 'hover:bg-sand',
						)}
						style={{
							gridTemplateColumns: cols,
							animation: `fade-up 0.3s ease ${i * 0.04}s both`,
						}}
					>
						<div className='flex min-w-0 items-center gap-2.5'>
							<TypeIcon type={type} />
							<span className='text-cobalt-800 truncate text-[13px] font-medium'>{doc.name}</span>
						</div>
						<div className='text-cobalt-700 font-mono text-xs font-medium'>{doc.chunkCount}</div>
						<div
							className='text-smoke font-mono text-[10px] tracking-[0.06em] uppercase'
							title='Chunking strategy used at upload (not editable)'
						>
							{doc.chunkingStrategy ?? '—'}
						</div>
						<div
							className='text-smoke font-mono text-[11px]'
							title={new Date(doc.createdAt).toLocaleString()}
						>
							{formatRelative(doc.createdAt)}
						</div>
						{onDelete && (
							<IconButton
								tone='danger'
								size='sm'
								onClick={e => {
									e.stopPropagation();
									void onDelete(doc.documentId);
								}}
								title='Delete document'
								aria-label='Delete document'
								className='text-smoke text-lg leading-none'
							>
								×
							</IconButton>
						)}
					</div>
				);
			})}
		</div>
	);
}
