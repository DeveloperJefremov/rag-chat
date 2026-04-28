'use client';
import clsx from 'clsx';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

interface Props {
	docs: IngestResponseDto[];
	active: Set<string>;
	onToggle: (id: string) => void;
	onDetach: (id: string) => void;
}

export function AttachmentChips({ docs, active, onToggle, onDetach }: Props) {
	return (
		<div className='flex flex-wrap items-center gap-1.5'>
			{docs.map(d => {
				const isActive = active.has(d.documentId);
				return (
					<span
						key={d.documentId}
						className={clsx(
							'desk:max-w-none inline-flex max-w-[160px] items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
							isActive
								? 'border-cobalt-800 bg-cobalt-800 text-paper'
								: 'border-powder-300 bg-paper text-cobalt-800',
						)}
					>
						<button
							type='button'
							onClick={() => onToggle(d.documentId)}
							className='desk:max-w-none max-w-[120px] cursor-pointer truncate'
							title={isActive ? 'Deactivate (will not be searched)' : 'Activate'}
						>
							{d.name}
						</button>
						<button
							type='button'
							onClick={() => onDetach(d.documentId)}
							className={clsx(
								'cursor-pointer transition-colors',
								isActive
									? 'text-paper/70 hover:text-paper'
									: 'text-smoke hover:text-terracotta-600',
							)}
							title='Detach from chat'
						>
							×
						</button>
					</span>
				);
			})}
		</div>
	);
}
