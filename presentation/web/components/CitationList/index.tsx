import { CitationDto } from '@/shared/dtos/CitationDto';

interface CitationListProps {
	citations: CitationDto[];
}

export function CitationList({ citations }: CitationListProps) {
	if (citations.length === 0) return null;

	return (
		<div className='border-terracotta-500 bg-sand mt-2 border-l-2 px-3.5 py-2.5'>
			<span className='text-terracotta-700 mb-1.5 block font-mono text-[9px] tracking-[0.2em] uppercase'>
				→ Retrieved from
			</span>
			<div>
				{citations.map(c => (
					<span
						key={c.index}
						title={c.content}
						className='border-powder-300 bg-paper text-cobalt-700 mt-1 mr-1 inline-block cursor-pointer rounded-[3px] border px-2 py-px font-mono text-[10px]'
					>
						{c.documentName} · §{c.index + 1}
					</span>
				))}
			</div>
		</div>
	);
}
