'use client';
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
						className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
							isActive
								? 'border-primary/40 bg-primary/10 text-primary'
								: 'border-border bg-muted text-muted-foreground'
						}`}
					>
						<button
							type='button'
							onClick={() => onToggle(d.documentId)}
							className='cursor-pointer'
							title={isActive ? 'Deactivate (will not be searched)' : 'Activate'}
						>
							{d.name}
						</button>
						<button
							type='button'
							onClick={() => onDetach(d.documentId)}
							className='text-muted-foreground hover:text-destructive cursor-pointer'
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
