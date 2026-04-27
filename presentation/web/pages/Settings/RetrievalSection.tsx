'use client';
import { useControlsStore } from '@/client/stores/controlsStore';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };
const SERIF: React.CSSProperties = { fontFamily: 'var(--font-fraunces), serif' };

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
		<section id='retrieval' style={{ marginBottom: 56, scrollMarginTop: 24 }}>
			<header style={{ marginBottom: 20 }}>
				<h2
					style={{
						...SERIF,
						fontStyle: 'italic',
						fontWeight: 300,
						fontSize: 26,
						color: 'var(--cobalt-900)',
						letterSpacing: '-0.01em',
						margin: 0,
					}}
				>
					Retrieval
				</h2>
				<div
					style={{
						...MONO,
						fontSize: 10,
						color: 'var(--smoke)',
						letterSpacing: '0.12em',
						textTransform: 'uppercase',
						marginTop: 4,
					}}
				>
					Defaults for chunking, search, and reranking
				</div>
			</header>

			<div
				style={{
					border: '1px solid var(--powder-200)',
					borderRadius: 10,
					padding: 22,
					background: 'var(--paper)',
					display: 'flex',
					flexDirection: 'column',
					gap: 26,
				}}
			>
				{/* Chunking strategy */}
				<div>
					<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
						<div>
							<div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cobalt-900)' }}>
								Chunking strategy
							</div>
							<div style={{ fontSize: 12, color: 'var(--smoke)', marginTop: 2 }}>
								Applied to newly uploaded documents.
							</div>
						</div>
					</div>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
							gap: 8,
						}}
					>
						{STRATEGIES.map(s => {
							const active = chunkingStrategy === s.id;
							return (
								<button
									key={s.id}
									onClick={() => setStrategy(s.id)}
									style={{
										padding: '10px 12px',
										textAlign: 'left',
										background: active ? 'var(--cobalt-800)' : 'var(--paper)',
										color: active ? 'var(--paper)' : 'var(--cobalt-800)',
										border: `1px solid ${active ? 'var(--cobalt-800)' : 'var(--powder-300)'}`,
										borderRadius: 8,
										cursor: 'pointer',
										transition: 'all 0.15s',
									}}
								>
									<div
										style={{
											...MONO,
											fontSize: 11,
											letterSpacing: '0.08em',
											textTransform: 'uppercase',
											marginBottom: 2,
										}}
									>
										{s.label}
									</div>
									<div
										style={{
											fontSize: 11,
											color: active ? 'rgba(241,233,219,0.7)' : 'var(--smoke)',
										}}
									>
										{s.desc}
									</div>
								</button>
							);
						})}
					</div>
				</div>

				<div style={{ height: 1, background: 'var(--powder-200)' }} />

				{/* Top-K */}
				<div>
					<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
						<div>
							<div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cobalt-900)' }}>
								Top-K chunks
							</div>
							<div style={{ fontSize: 12, color: 'var(--smoke)', marginTop: 2 }}>
								Number of chunks retrieved before reranking.
							</div>
						</div>
					</div>
					<div style={{ display: 'flex', gap: 8 }}>
						{TOP_K_OPTIONS.map(k => {
							const active = topK === k;
							return (
								<button
									key={k}
									onClick={() => setTopK(k)}
									style={{
										...MONO,
										padding: '8px 18px',
										fontSize: 12,
										background: active ? 'var(--cobalt-800)' : 'var(--paper)',
										color: active ? 'var(--paper)' : 'var(--cobalt-800)',
										border: `1px solid ${active ? 'var(--cobalt-800)' : 'var(--powder-300)'}`,
										borderRadius: 7,
										cursor: 'pointer',
										transition: 'all 0.15s',
									}}
								>
									{k}
								</button>
							);
						})}
					</div>
				</div>

				<div style={{ height: 1, background: 'var(--powder-200)' }} />

				{/* Reranking */}
				<div>
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							gap: 16,
						}}
					>
						<div style={{ flex: 1 }}>
							<div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cobalt-900)' }}>
								Reranking
							</div>
							<div style={{ fontSize: 12, color: 'var(--smoke)', marginTop: 2 }}>
								Re-orders retrieved chunks by relevance before sending to the LLM.
							</div>
						</div>
						<button
							onClick={() => setReranking(!rerankingEnabled)}
							role='switch'
							aria-checked={rerankingEnabled}
							style={{
								width: 44,
								height: 24,
								borderRadius: 999,
								background: rerankingEnabled ? 'var(--cobalt-800)' : 'var(--powder-300)',
								border: 'none',
								position: 'relative',
								cursor: 'pointer',
								transition: 'background 0.15s',
								flexShrink: 0,
							}}
						>
							<span
								style={{
									position: 'absolute',
									top: 2,
									left: rerankingEnabled ? 22 : 2,
									width: 20,
									height: 20,
									borderRadius: '50%',
									background: 'var(--paper)',
									transition: 'left 0.15s',
								}}
							/>
						</button>
					</div>
				</div>
			</div>
		</section>
	);
}
