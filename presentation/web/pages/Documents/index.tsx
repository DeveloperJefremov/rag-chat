'use client';
import { useEffect, useState } from 'react';
import { useUploadStore } from '@/client/stores/uploadStore';
import { FileDropzone } from '@/presentation/web/components/FileDropzone';
import { MobileMenuButton } from '@/presentation/web/components/MobileMenuButton';
import { ToggleChip } from '@/presentation/web/components/ui/ToggleChip';
import { IconButton } from '@/presentation/web/components/ui/IconButton';
import { DocumentTable } from './DocumentTable';
import { DocumentCardList } from './DocumentCardList';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

const STRATEGIES: Array<{ id: ChunkingStrategy; label: string; desc: string }> = [
	{ id: 'FIXED', label: 'Fixed-size', desc: '512 tokens, 64 overlap' },
	{ id: 'SENTENCE', label: 'Sentence', desc: 'NLTK sentence tokenizer' },
	{ id: 'PARAGRAPH', label: 'Paragraph', desc: 'Paragraph boundaries' },
	{ id: 'RECURSIVE', label: 'Recursive', desc: 'Hierarchical splitting' },
];

function ChunkPreviewPanel({ doc, onClose }: { doc: IngestResponseDto; onClose: () => void }) {
	return (
		<div className='bg-paper border-powder-200 desk:flex desk:w-[340px] desk:min-w-[340px] hidden h-full animate-[fade-up_0.25s_ease_both] flex-col border-l'>
			<div className='border-powder-200 flex items-start justify-between border-b px-5 py-4'>
				<div>
					<div className='text-cobalt-800 mb-[3px] text-[13px] font-medium'>{doc.name}</div>
					<div className='text-smoke font-mono text-[10px] tracking-[0.08em]'>
						{doc.chunkCount} chunks · {doc.chunkingStrategy ?? 'default'}
					</div>
				</div>
				<IconButton
					onClick={onClose}
					size='sm'
					className='text-smoke hover:text-cobalt-800 hover:bg-transparent'
					aria-label='Close preview'
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
				</IconButton>
			</div>
			<div className='flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-3.5'>
				<div className='border-l-cobalt-500 bg-sand rounded-md border-l-[3px] px-3.5 py-3'>
					<div className='text-smoke mb-2 font-mono text-[9px] tracking-[0.12em] uppercase'>
						Document indexed
					</div>
					<p className='text-ink text-xs leading-[1.6]'>
						{doc.chunkCount} chunks generated using{' '}
						<strong>{doc.chunkingStrategy ?? 'default'}</strong> strategy. Document ID:{' '}
						<code className='font-mono text-[10px]'>{doc.documentId.slice(0, 8)}…</code>
					</p>
				</div>
				<div className='border-l-terracotta-500 bg-sand rounded-md border-l-[3px] px-3.5 py-3'>
					<div className='text-smoke mb-2 font-mono text-[9px] tracking-[0.12em] uppercase'>
						Ready for retrieval
					</div>
					<p className='text-ink text-xs leading-[1.6]'>
						Ask questions about this document from the <strong>Chat</strong> page. Each chunk was
						embedded with Google text-embedding-004 (768d).
					</p>
				</div>
			</div>
		</div>
	);
}

export function DocumentsPage() {
	const { documents, status, upload, fetchDocuments, removeDocument } = useUploadStore();
	const [strategy, setStrategy] = useState<ChunkingStrategy>('RECURSIVE');
	const [selected, setSelected] = useState<IngestResponseDto | null>(null);
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		fetchDocuments();
	}, [fetchDocuments]);

	const handleFile = async (file: File) => {
		setProgress(10);
		const progressInterval = setInterval(() => {
			setProgress(p => Math.min(p + Math.random() * 12, 90));
		}, 200);

		try {
			await upload(file, { chunkingStrategy: strategy });
			setProgress(100);
		} finally {
			clearInterval(progressInterval);
			setTimeout(() => setProgress(0), 600);
		}
	};

	const totalChunks = documents.reduce((a, d) => a + d.chunkCount, 0);
	const uploading = status === 'uploading';
	const activeStrategy = STRATEGIES.find(s => s.id === strategy);

	return (
		<div className='bg-paper flex h-full flex-col overflow-hidden'>
			<div className='border-powder-200 bg-paper desk:px-7 desk:py-[18px] flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3'>
				<div className='flex min-w-0 items-center gap-3'>
					<MobileMenuButton />
					<div className='min-w-0'>
						<h1 className='text-cobalt-800 desk:text-[22px] m-0 font-serif text-xl font-light tracking-[-0.01em] italic'>
							Documents
						</h1>
						<div className='text-smoke mt-0.5 font-mono text-[10px] tracking-[0.1em] uppercase'>
							{documents.length} files · {totalChunks} chunks indexed
						</div>
					</div>
				</div>
				<div className='desk:flex hidden gap-2'>
					{STRATEGIES.map(s => (
						<ToggleChip
							key={s.id}
							active={strategy === s.id}
							onClick={() => setStrategy(s.id)}
							title={s.desc}
						>
							{s.label}
						</ToggleChip>
					))}
				</div>
			</div>

			<div className='flex flex-1 overflow-hidden'>
				<div className='desk:px-7 desk:py-6 flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5'>
					<FileDropzone
						onFile={handleFile}
						disabled={uploading}
						uploading={uploading}
						progress={Math.round(progress)}
					/>

					<div className='desk:hidden flex flex-wrap gap-2'>
						{STRATEGIES.map(s => (
							<ToggleChip
								key={s.id}
								active={strategy === s.id}
								onClick={() => setStrategy(s.id)}
								title={s.desc}
								className='px-3'
							>
								{s.label}
							</ToggleChip>
						))}
					</div>

					<div className='bg-sand flex flex-wrap items-center gap-3 rounded-lg px-4 py-2.5'>
						<div className='bg-terracotta-500 h-1.5 w-1.5 flex-shrink-0 rounded-[1px]' />
						<span className='text-terracotta-700 font-mono text-[10px] tracking-[0.12em] uppercase'>
							Strategy:
						</span>
						<span className='text-cobalt-800 text-xs font-medium'>{activeStrategy?.label}</span>
						<span className='text-smoke font-mono text-[11px]'>— {activeStrategy?.desc}</span>
					</div>

					<DocumentTable
						className='desk:block hidden'
						documents={documents}
						selectedId={selected?.documentId ?? null}
						onSelect={setSelected}
						onDelete={removeDocument}
					/>
					<DocumentCardList
						className='desk:hidden'
						documents={documents}
						selectedId={selected?.documentId ?? null}
						onSelect={setSelected}
						onDelete={removeDocument}
					/>
				</div>

				{selected && <ChunkPreviewPanel doc={selected} onClose={() => setSelected(null)} />}
			</div>
		</div>
	);
}
