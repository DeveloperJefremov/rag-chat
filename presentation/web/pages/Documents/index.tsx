'use client';
import { useState } from 'react';
import { useSessionStore } from '@/client/stores/sessionStore';
import { useUploadStore } from '@/client/stores/uploadStore';
import { FileDropzone } from '@/presentation/web/components/FileDropzone';
import { DocumentTable } from './DocumentTable';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };

const STRATEGIES: Array<{ id: ChunkingStrategy; label: string; desc: string }> = [
	{ id: 'FIXED', label: 'Fixed-size', desc: '512 tokens, 64 overlap' },
	{ id: 'SENTENCE', label: 'Sentence', desc: 'NLTK sentence tokenizer' },
	{ id: 'PARAGRAPH', label: 'Paragraph', desc: 'Paragraph boundaries' },
	{ id: 'RECURSIVE', label: 'Recursive', desc: 'Hierarchical splitting' },
];

function ChunkPreviewPanel({ doc, onClose }: { doc: IngestResponseDto; onClose: () => void }) {
	return (
		<div
			style={{
				width: 340,
				minWidth: 340,
				height: '100%',
				background: 'var(--paper)',
				borderLeft: '1px solid var(--powder-200)',
				display: 'flex',
				flexDirection: 'column',
				animation: 'fade-up 0.25s ease both',
			}}
		>
			<div
				style={{
					padding: '16px 20px',
					borderBottom: '1px solid var(--powder-200)',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
				}}
			>
				<div>
					<div
						style={{
							fontFamily: 'inherit',
							fontSize: 13,
							fontWeight: 500,
							color: 'var(--cobalt-800)',
							marginBottom: 3,
						}}
					>
						{doc.name}
					</div>
					<div
						style={{
							...MONO,
							fontSize: 10,
							color: 'var(--smoke)',
							letterSpacing: '0.08em',
						}}
					>
						{doc.chunkCount} chunks · {doc.chunkingStrategy ?? 'default'}
					</div>
				</div>
				<button
					onClick={onClose}
					style={{
						background: 'none',
						border: 'none',
						cursor: 'pointer',
						color: 'var(--smoke)',
						padding: 4,
					}}
				>
					<svg
						width='16'
						height='16'
						viewBox='0 0 24 24'
						fill='none'
						stroke='currentColor'
						strokeWidth='2'
					>
						<line x1='18' y1='6' x2='6' y2='18' />
						<line x1='6' y1='6' x2='18' y2='18' />
					</svg>
				</button>
			</div>
			<div
				style={{
					flex: 1,
					overflowY: 'auto',
					padding: '14px 20px',
					display: 'flex',
					flexDirection: 'column',
					gap: 10,
				}}
			>
				<div
					style={{
						padding: '12px 14px',
						background: 'var(--sand)',
						borderRadius: 6,
						borderLeft: '3px solid var(--cobalt-500)',
					}}
				>
					<div
						style={{
							...MONO,
							fontSize: 9,
							color: 'var(--smoke)',
							letterSpacing: '0.12em',
							textTransform: 'uppercase',
							marginBottom: 8,
						}}
					>
						Document indexed
					</div>
					<p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink)' }}>
						{doc.chunkCount} chunks generated using{' '}
						<strong>{doc.chunkingStrategy ?? 'default'}</strong> strategy. Document ID:{' '}
						<code style={{ ...MONO, fontSize: 10 }}>{doc.documentId.slice(0, 8)}…</code>
					</p>
				</div>
				<div
					style={{
						padding: '12px 14px',
						background: 'var(--sand)',
						borderRadius: 6,
						borderLeft: '3px solid var(--terracotta-500)',
					}}
				>
					<div
						style={{
							...MONO,
							fontSize: 9,
							color: 'var(--smoke)',
							letterSpacing: '0.12em',
							textTransform: 'uppercase',
							marginBottom: 8,
						}}
					>
						Ready for retrieval
					</div>
					<p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--ink)' }}>
						Ask questions about this document from the <strong>Chat</strong> page. Each chunk was
						embedded with Google text-embedding-004 (768d).
					</p>
				</div>
			</div>
		</div>
	);
}

export function DocumentsPage() {
	const { sessions, activeSessionId, createSession } = useSessionStore();
	const { documents, status, upload } = useUploadStore();
	const [strategy, setStrategy] = useState<ChunkingStrategy>('RECURSIVE');
	const [selected, setSelected] = useState<IngestResponseDto | null>(null);
	const [progress, setProgress] = useState(0);

	const handleFile = async (file: File) => {
		let sessionId = activeSessionId ?? sessions[0]?.id;
		if (!sessionId) {
			const newSession = await createSession();
			sessionId = newSession.id;
		}

		setProgress(10);
		const progressInterval = setInterval(() => {
			setProgress(p => Math.min(p + Math.random() * 12, 90));
		}, 200);

		try {
			await upload(file, sessionId, strategy);
			setProgress(100);
		} finally {
			clearInterval(progressInterval);
			setTimeout(() => setProgress(0), 600);
		}
	};

	const totalChunks = documents.reduce((a, d) => a + d.chunkCount, 0);
	const uploading = status === 'uploading';

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				background: 'var(--paper)',
				overflow: 'hidden',
			}}
		>
			{/* Header */}
			<div
				style={{
					padding: '18px 28px',
					borderBottom: '1px solid var(--powder-200)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					flexShrink: 0,
					background: 'var(--paper)',
				}}
			>
				<div>
					<h1
						style={{
							fontFamily: 'var(--font-fraunces), serif',
							fontWeight: 300,
							fontSize: 22,
							color: 'var(--cobalt-800)',
							letterSpacing: '-0.01em',
							fontStyle: 'italic',
						}}
					>
						Documents
					</h1>
					<div
						style={{
							...MONO,
							fontSize: 10,
							color: 'var(--smoke)',
							letterSpacing: '0.1em',
							textTransform: 'uppercase',
							marginTop: 2,
						}}
					>
						{documents.length} files · {totalChunks} chunks indexed
					</div>
				</div>
				<div style={{ display: 'flex', gap: 8 }}>
					{STRATEGIES.map(s => (
						<button
							key={s.id}
							onClick={() => setStrategy(s.id)}
							title={s.desc}
							style={{
								padding: '7px 14px',
								background: strategy === s.id ? 'var(--cobalt-800)' : 'var(--paper)',
								color: strategy === s.id ? 'var(--paper)' : 'var(--smoke)',
								border: `1px solid ${strategy === s.id ? 'var(--cobalt-800)' : 'var(--powder-300)'}`,
								borderRadius: 7,
								fontFamily: 'inherit',
								fontSize: 12,
								cursor: 'pointer',
								transition: 'all 0.15s',
							}}
						>
							{s.label}
						</button>
					))}
				</div>
			</div>

			<div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
				<div
					style={{
						flex: 1,
						overflowY: 'auto',
						padding: '24px 28px',
						display: 'flex',
						flexDirection: 'column',
						gap: 20,
					}}
				>
					<FileDropzone
						onFile={handleFile}
						disabled={uploading}
						uploading={uploading}
						progress={Math.round(progress)}
					/>

					{/* Strategy info bar */}
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 12,
							padding: '10px 16px',
							background: 'var(--sand)',
							borderRadius: 8,
						}}
					>
						<div
							style={{
								width: 6,
								height: 6,
								borderRadius: 1,
								background: 'var(--terracotta-500)',
								flexShrink: 0,
							}}
						/>
						<span
							style={{
								...MONO,
								fontSize: 10,
								letterSpacing: '0.12em',
								textTransform: 'uppercase',
								color: 'var(--terracotta-700)',
							}}
						>
							Strategy:
						</span>
						<span
							style={{
								fontFamily: 'inherit',
								fontSize: 12,
								color: 'var(--cobalt-800)',
								fontWeight: 500,
							}}
						>
							{STRATEGIES.find(s => s.id === strategy)?.label}
						</span>
						<span style={{ ...MONO, fontSize: 11, color: 'var(--smoke)' }}>
							— {STRATEGIES.find(s => s.id === strategy)?.desc}
						</span>
					</div>

					<DocumentTable
						documents={documents}
						selectedId={selected?.documentId ?? null}
						onSelect={setSelected}
					/>
				</div>

				{selected && <ChunkPreviewPanel doc={selected} onClose={() => setSelected(null)} />}
			</div>
		</div>
	);
}
