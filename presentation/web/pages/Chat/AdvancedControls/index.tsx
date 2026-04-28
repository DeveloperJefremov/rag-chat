'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useControlsStore } from '@/client/stores/controlsStore';
import { Switch } from '@/presentation/components/ui/switch';
import { Label } from '@/presentation/components/ui/label';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';

const STRATEGIES: ChunkingStrategy[] = ['FIXED', 'SENTENCE', 'PARAGRAPH', 'RECURSIVE'];
const TOP_K_OPTIONS = [5, 10, 20];

export function AdvancedControls() {
	const [open, setOpen] = useState(false);
	const { chunkingStrategy, topK, rerankingEnabled, setStrategy, setTopK, setReranking } =
		useControlsStore();

	return (
		<div className='bg-muted/20 border-t'>
			<button
				onClick={() => setOpen(o => !o)}
				className='text-muted-foreground hover:text-foreground flex w-full items-center justify-between px-4 py-2 text-xs transition-colors'
			>
				<span className='font-medium'>Advanced Controls</span>
				{open ? <ChevronUp className='h-3 w-3' /> : <ChevronDown className='h-3 w-3' />}
			</button>

			{open && (
				<div className='desk:grid-cols-3 grid grid-cols-1 gap-4 px-4 pb-3 text-xs'>
					{/* Chunking Strategy */}
					<div className='space-y-1'>
						<Label className='text-muted-foreground text-xs'>Chunking Strategy</Label>
						<div className='flex flex-col gap-0.5'>
							{STRATEGIES.map(s => (
								<button
									key={s}
									onClick={() => setStrategy(s)}
									className={`rounded px-2 py-1 text-left text-xs transition-colors ${
										chunkingStrategy === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
									}`}
								>
									{s}
								</button>
							))}
						</div>
					</div>

					{/* Top-K */}
					<div className='space-y-1'>
						<Label className='text-muted-foreground text-xs'>Top-K Chunks</Label>
						<div className='flex flex-col gap-0.5'>
							{TOP_K_OPTIONS.map(k => (
								<button
									key={k}
									onClick={() => setTopK(k)}
									className={`rounded px-2 py-1 text-left text-xs transition-colors ${
										topK === k ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
									}`}
								>
									{k}
								</button>
							))}
						</div>
					</div>

					{/* Reranking */}
					<div className='space-y-1'>
						<Label className='text-muted-foreground text-xs'>Reranking</Label>
						<div className='flex items-center gap-2 pt-1'>
							<Switch
								checked={rerankingEnabled}
								onCheckedChange={setReranking}
								id='reranking-toggle'
							/>
							<Label htmlFor='reranking-toggle' className='text-xs'>
								{rerankingEnabled ? 'On' : 'Off'}
							</Label>
						</div>
						<p className='text-muted-foreground text-xs leading-tight'>
							Cohere rerank improves relevance
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
