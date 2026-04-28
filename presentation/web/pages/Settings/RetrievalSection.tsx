'use client';
import clsx from 'clsx';
import { useControlsStore } from '@/client/stores/controlsStore';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';

const STRATEGIES: Array<{ id: ChunkingStrategy; label: string; desc: string }> = [
	{ id: 'FIXED', label: 'Fixed-size', desc: '512 tokens, 50 overlap' },
	{ id: 'SENTENCE', label: 'Sentence', desc: 'Sentence boundaries' },
	{ id: 'PARAGRAPH', label: 'Paragraph', desc: 'Paragraph boundaries' },
	{ id: 'RECURSIVE', label: 'Recursive', desc: 'Hierarchical splitting' },
];

const TOP_K_OPTIONS = [3, 5, 10, 20];

export function RetrievalSection() {
	const { chunkingStrategy, topK, rerankingEnabled, setStrategy, setTopK, setReranking } =
		useControlsStore();

	return (
		<section id='retrieval' className='scroll-mt-6'>
			<header className='mb-5'>
				<h2 className='text-cobalt-900 desk:text-[26px] m-0 font-serif text-2xl font-light tracking-[-0.01em] italic'>
					Retrieval
				</h2>
				<div className='text-smoke mt-1 font-mono text-[10px] tracking-[0.12em] uppercase'>
					Defaults for chunking, search, and reranking
				</div>
			</header>

			<div className='border-powder-200 bg-paper desk:p-[22px] flex flex-col gap-6 rounded-[10px] border p-5'>
				<div>
					<div className='mb-2.5'>
						<div className='text-cobalt-900 text-sm font-medium'>Chunking strategy</div>
						<div className='text-smoke mt-0.5 text-xs'>Applied to newly uploaded documents.</div>
					</div>
					<div className='desk:grid-cols-2 grid grid-cols-1 gap-2'>
						{STRATEGIES.map(s => {
							const active = chunkingStrategy === s.id;
							return (
								<button
									type='button'
									key={s.id}
									onClick={() => setStrategy(s.id)}
									className={clsx(
										'cursor-pointer rounded-md border px-3 py-2.5 text-left transition-colors',
										active
											? 'border-cobalt-800 bg-cobalt-800 text-paper'
											: 'border-powder-300 bg-paper text-cobalt-800 hover:border-cobalt-700',
									)}
								>
									<div className='mb-0.5 font-mono text-[11px] tracking-[0.08em] uppercase'>
										{s.label}
									</div>
									<div className={clsx('text-[11px]', active ? 'text-paper/70' : 'text-smoke')}>
										{s.desc}
									</div>
								</button>
							);
						})}
					</div>
				</div>

				<div className='bg-powder-200 h-px' />

				<div>
					<div className='mb-2.5'>
						<div className='text-cobalt-900 text-sm font-medium'>Top-K chunks</div>
						<div className='text-smoke mt-0.5 text-xs'>
							Number of chunks retrieved before reranking.
						</div>
					</div>
					<div className='flex flex-wrap gap-2'>
						{TOP_K_OPTIONS.map(k => {
							const active = topK === k;
							return (
								<button
									type='button'
									key={k}
									onClick={() => setTopK(k)}
									className={clsx(
										'cursor-pointer rounded-md border px-[18px] py-2 font-mono text-xs transition-colors',
										active
											? 'border-cobalt-800 bg-cobalt-800 text-paper'
											: 'border-powder-300 bg-paper text-cobalt-800 hover:border-cobalt-700',
									)}
								>
									{k}
								</button>
							);
						})}
					</div>
				</div>

				<div className='bg-powder-200 h-px' />

				<div className='flex items-center justify-between gap-4'>
					<div className='flex-1'>
						<div className='text-cobalt-900 text-sm font-medium'>Reranking</div>
						<div className='text-smoke mt-0.5 text-xs'>
							Re-orders retrieved chunks by relevance before sending to the LLM.
						</div>
					</div>
					<button
						type='button'
						onClick={() => setReranking(!rerankingEnabled)}
						role='switch'
						aria-checked={rerankingEnabled}
						className={clsx(
							'relative h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-none transition-colors',
							rerankingEnabled ? 'bg-cobalt-800' : 'bg-powder-300',
						)}
					>
						<span
							className={clsx(
								'bg-paper absolute top-0.5 h-5 w-5 rounded-full transition-[left]',
								rerankingEnabled ? 'left-[22px]' : 'left-0.5',
							)}
						/>
					</button>
				</div>
			</div>
		</section>
	);
}
