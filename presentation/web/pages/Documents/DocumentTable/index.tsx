'use client';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

interface DocumentTableProps {
	documents: IngestResponseDto[];
	selectedId: string | null;
	onSelect: (doc: IngestResponseDto | null) => void;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };

function TypeIcon({ type }: { type: 'pdf' | 'md' | 'txt' | 'docx' }) {
	const bg = type === 'pdf' ? 'var(--terracotta-600)' : 'var(--cobalt-700)';
	return (
		<div
			style={{
				width: 32,
				height: 32,
				borderRadius: 6,
				background: bg,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				flexShrink: 0,
			}}
		>
			<span
				style={{
					...MONO,
					fontSize: 9,
					fontWeight: 500,
					color: 'var(--paper)',
					letterSpacing: '0.05em',
				}}
			>
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

export function DocumentTable({ documents, selectedId, onSelect }: DocumentTableProps) {
	if (documents.length === 0) {
		return (
			<div
				style={{
					background: 'var(--paper)',
					border: '1px solid var(--powder-200)',
					borderRadius: 8,
					padding: '40px 20px',
					textAlign: 'center',
				}}
			>
				<p style={{ ...MONO, fontSize: 12, color: 'var(--smoke)' }}>No documents uploaded yet.</p>
			</div>
		);
	}

	const cols = '2fr 80px 80px 70px 90px 80px';

	return (
		<div
			style={{
				background: 'var(--paper)',
				border: '1px solid var(--powder-200)',
				borderRadius: 8,
				overflow: 'hidden',
			}}
		>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: cols,
					padding: '10px 16px',
					background: 'var(--sand)',
					borderBottom: '1px solid var(--powder-200)',
				}}
			>
				{['Document', 'Type', 'Size', 'Chunks', 'Tokens', 'Added'].map(h => (
					<div
						key={h}
						style={{
							...MONO,
							fontSize: 9,
							letterSpacing: '0.15em',
							textTransform: 'uppercase',
							color: 'var(--smoke)',
						}}
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
						style={{
							display: 'grid',
							gridTemplateColumns: cols,
							padding: '12px 16px',
							borderBottom: i < documents.length - 1 ? '1px solid var(--powder-200)' : 'none',
							cursor: 'pointer',
							background: isActive ? 'var(--powder-100)' : 'transparent',
							transition: 'background 0.12s',
							alignItems: 'center',
							animation: `fade-up 0.3s ease ${i * 0.04}s both`,
						}}
						onMouseEnter={e => {
							if (!isActive) e.currentTarget.style.background = 'var(--sand)';
						}}
						onMouseLeave={e => {
							if (!isActive) e.currentTarget.style.background = 'transparent';
						}}
					>
						<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							<TypeIcon type={type} />
							<span
								style={{
									fontFamily: 'inherit',
									fontSize: 13,
									color: 'var(--cobalt-800)',
									fontWeight: 500,
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
								}}
							>
								{doc.name}
							</span>
						</div>
						<div
							style={{
								...MONO,
								fontSize: 11,
								color: 'var(--smoke)',
								textTransform: 'uppercase',
								letterSpacing: '0.06em',
							}}
						>
							{type}
						</div>
						<div style={{ ...MONO, fontSize: 11, color: 'var(--smoke)' }}>—</div>
						<div
							style={{
								...MONO,
								fontSize: 12,
								color: 'var(--cobalt-700)',
								fontWeight: 500,
							}}
						>
							{doc.chunkCount}
						</div>
						<div style={{ ...MONO, fontSize: 11, color: 'var(--smoke)' }}>—</div>
						<div style={{ ...MONO, fontSize: 11, color: 'var(--smoke) ' }}>Just now</div>
					</div>
				);
			})}
		</div>
	);
}
