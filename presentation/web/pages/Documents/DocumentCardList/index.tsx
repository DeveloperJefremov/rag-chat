'use client';
import clsx from 'clsx';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';
import { IconButton } from '@/presentation/web/components/ui/IconButton';
import { Skeleton } from '@/presentation/components/ui/skeleton';

interface Props {
	documents: IngestResponseDto[];
	selectedId: string | null;
	onSelect: (doc: IngestResponseDto | null) => void;
	onDelete?: (id: string) => Promise<void> | void;
	loading?: boolean;
	className?: string;
}

function fileType(name: string): string {
	const ext = name.split('.').pop()?.toLowerCase();
	return (ext ?? 'txt').toUpperCase();
}

export function DocumentCardList({
	documents,
	selectedId,
	onSelect,
	onDelete,
	loading,
	className,
}: Props) {
	if (loading && documents.length === 0) {
		return (
			<div
				className={clsx('flex flex-col gap-2', className)}
				aria-busy='true'
				aria-live='polite'
				aria-label='Loading documents'
			>
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={i}
						className='border-powder-200 bg-paper flex items-start gap-3 rounded-lg border p-4'
					>
						<div className='min-w-0 flex-1'>
							<div className='flex items-center gap-2'>
								<Skeleton className='h-3.5 w-2/5' />
								<Skeleton className='h-2.5 w-8 flex-shrink-0' />
							</div>
							<Skeleton className='mt-2 h-2.5 w-1/3' />
						</div>
						{onDelete && <Skeleton className='h-6 w-6 flex-shrink-0 rounded' />}
					</div>
				))}
			</div>
		);
	}

	if (documents.length === 0) {
		return (
			<div className={clsx('text-smoke py-10 text-center text-sm', className)}>
				No documents yet
			</div>
		);
	}
	return (
		<div className={clsx('flex flex-col gap-2', className)}>
			{documents.map(d => {
				const isActive = d.documentId === selectedId;
				return (
					<div
						key={d.documentId}
						onClick={() => onSelect(isActive ? null : d)}
						className={clsx(
							'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
							isActive
								? 'border-cobalt-700 bg-powder-100'
								: 'border-powder-200 bg-paper hover:bg-sand',
						)}
					>
						<div className='min-w-0 flex-1'>
							<div className='flex items-center gap-2'>
								<span className='text-cobalt-900 truncate text-sm font-medium'>{d.name}</span>
								<span className='text-smoke flex-shrink-0 font-mono text-[10px] tracking-[0.1em] uppercase'>
									{fileType(d.name)}
								</span>
							</div>
							<div className='text-smoke mt-1 font-mono text-[11px]'>
								{d.chunkCount} chunks · {d.chunkingStrategy ?? 'default'}
							</div>
						</div>
						{onDelete && (
							<IconButton
								tone='danger'
								size='md'
								aria-label='Delete document'
								onClick={e => {
									e.stopPropagation();
									void onDelete(d.documentId);
								}}
							>
								<svg
									width='14'
									height='14'
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									strokeWidth='1.8'
								>
									<polyline points='3 6 5 6 21 6' />
									<path d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' />
									<path d='M10 11v6M14 11v6' />
									<path d='M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2' />
								</svg>
							</IconButton>
						)}
					</div>
				);
			})}
		</div>
	);
}
