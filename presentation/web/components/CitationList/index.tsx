import { CitationDto } from '@/shared/dtos/CitationDto';

interface CitationListProps {
	citations: CitationDto[];
}

export function CitationList({ citations }: CitationListProps) {
	if (citations.length === 0) return null;

	return (
		<div className='border-t border-white/20 pt-2'>
			<p className='mb-1 text-xs font-medium opacity-70'>Sources</p>
			<ol className='space-y-0.5'>
				{citations.map(c => (
					<li key={c.index} className='text-xs opacity-80'>
						<span className='font-mono opacity-60'>[{c.index}]</span>{' '}
						<span className='font-medium'>{c.documentName}</span>
						{' — '}
						<span className='line-clamp-2'>{c.content}</span>
					</li>
				))}
			</ol>
		</div>
	);
}
