'use client';
import clsx from 'clsx';
import { useState } from 'react';
import { CitationDto } from '@/shared/dtos/CitationDto';
import { Button } from '@/presentation/components/ui/button';

interface CitationListProps {
	citations: CitationDto[];
}

export function CitationList({ citations }: CitationListProps) {
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

	if (citations.length === 0) return null;

	const expanded = citations.find(c => c.index === expandedIndex) ?? null;

	return (
		<div className='border-terracotta-500 bg-sand mt-2 border-l-2 px-3.5 py-2.5'>
			<span className='text-terracotta-700 mb-1.5 block font-mono text-[9px] tracking-[0.2em] uppercase'>
				→ Retrieved from
			</span>
			<div className='flex flex-wrap gap-1'>
				{citations.map(c => {
					const isOpen = expandedIndex === c.index;
					return (
						<Button
							key={c.index}
							type='button'
							variant='ghost'
							onClick={() => setExpandedIndex(prev => (prev === c.index ? null : c.index))}
							aria-expanded={isOpen}
							aria-label={`Show chunk ${c.index + 1} from ${c.documentName}`}
							className={clsx(
								'h-auto cursor-pointer rounded-[3px] border px-2 py-px font-mono text-[10px] font-normal transition-colors',
								isOpen
									? 'border-cobalt-700 bg-cobalt-700 text-paper hover:bg-cobalt-700 hover:text-paper'
									: 'border-powder-300 bg-paper text-cobalt-700 hover:border-cobalt-700 hover:bg-paper hover:text-cobalt-700',
							)}
						>
							{c.documentName} · §{c.index + 1}
						</Button>
					);
				})}
			</div>

			{expanded && (
				<div className='border-powder-300 bg-paper mt-2.5 animate-[fade-up_0.2s_ease_both] rounded-md border p-3'>
					<div className='mb-1.5 flex items-center justify-between gap-2'>
						<div className='text-smoke font-mono text-[9px] tracking-[0.12em] uppercase'>
							{expanded.documentName} · chunk §{expanded.index + 1}
						</div>
						<button
							type='button'
							onClick={() => setExpandedIndex(null)}
							aria-label='Close chunk preview'
							className='text-smoke hover:text-cobalt-800 cursor-pointer text-sm leading-none'
						>
							×
						</button>
					</div>
					<p className='text-ink m-0 text-xs leading-[1.6] whitespace-pre-wrap'>
						{expanded.content}
					</p>
				</div>
			)}
		</div>
	);
}
