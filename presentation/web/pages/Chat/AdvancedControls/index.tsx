'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useControlsStore } from '@/client/stores/controlsStore';
import { Button } from '@/presentation/components/ui/button';
import { Label } from '@/presentation/components/ui/label';
import { BrandSwitch } from '@/presentation/web/components/ui/BrandSwitch';
import { ToggleChip } from '@/presentation/web/components/ui/ToggleChip';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';

const STRATEGIES: ChunkingStrategy[] = ['FIXED', 'SENTENCE', 'PARAGRAPH', 'RECURSIVE'];
const TOP_K_OPTIONS = [5, 10, 20];

export function AdvancedControls() {
	const [open, setOpen] = useState(false);
	const { chunkingStrategy, topK, rerankingEnabled, setStrategy, setTopK, setReranking } =
		useControlsStore();

	return (
		<div className='bg-muted/20 border-t'>
			<Button
				type='button'
				variant='ghost'
				onClick={() => setOpen(o => !o)}
				className='text-muted-foreground hover:text-foreground flex h-auto w-full items-center justify-between rounded-none px-4 py-2 text-xs font-medium transition-colors hover:bg-transparent'
			>
				<span className='font-medium'>Advanced Controls</span>
				{open ? <ChevronUp className='h-3 w-3' /> : <ChevronDown className='h-3 w-3' />}
			</Button>

			{open && (
				<div className='desk:grid-cols-3 grid grid-cols-1 gap-4 px-4 pb-3 text-xs'>
					{/* Chunking Strategy */}
					<div className='space-y-1'>
						<Label className='text-muted-foreground text-xs'>Chunking Strategy</Label>
						<div className='flex flex-col gap-0.5'>
							{STRATEGIES.map(s => (
								<ToggleChip
									key={s}
									active={chunkingStrategy === s}
									onClick={() => setStrategy(s)}
									className='justify-start px-2 py-1 text-left text-xs'
								>
									{s}
								</ToggleChip>
							))}
						</div>
					</div>

					{/* Top-K */}
					<div className='space-y-1'>
						<Label className='text-muted-foreground text-xs'>Top-K Chunks</Label>
						<div className='flex flex-col gap-0.5'>
							{TOP_K_OPTIONS.map(k => (
								<ToggleChip
									key={k}
									active={topK === k}
									onClick={() => setTopK(k)}
									className='justify-start px-2 py-1 text-left text-xs'
								>
									{k}
								</ToggleChip>
							))}
						</div>
					</div>

					{/* Reranking */}
					<div className='space-y-1'>
						<Label className='text-muted-foreground text-xs'>Reranking</Label>
						<div className='flex items-center gap-2 pt-1'>
							<BrandSwitch
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
