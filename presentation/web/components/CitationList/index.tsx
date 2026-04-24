import { CitationDto } from '@/shared/dtos/CitationDto';

interface CitationListProps {
	citations: CitationDto[];
}

export function CitationList({ citations }: CitationListProps) {
	if (citations.length === 0) return null;

	return (
		<div
			style={{
				marginTop: 8,
				padding: '10px 14px',
				background: 'var(--sand)',
				borderLeft: '2px solid var(--terracotta-500)',
			}}
		>
			<span
				style={{
					display: 'block',
					fontFamily: 'var(--font-jetbrains-mono), monospace',
					fontSize: 9,
					letterSpacing: '0.2em',
					textTransform: 'uppercase',
					color: 'var(--terracotta-700)',
					marginBottom: 6,
				}}
			>
				→ Retrieved from
			</span>
			<div>
				{citations.map(c => (
					<span
						key={c.index}
						title={c.content}
						style={{
							display: 'inline-block',
							padding: '2px 8px',
							background: 'var(--paper)',
							border: '1px solid var(--powder-300)',
							borderRadius: 3,
							fontFamily: 'var(--font-jetbrains-mono), monospace',
							fontSize: 10,
							color: 'var(--cobalt-700)',
							marginRight: 4,
							marginTop: 4,
							cursor: 'pointer',
						}}
					>
						{c.documentName} · §{c.index + 1}
					</span>
				))}
			</div>
		</div>
	);
}
