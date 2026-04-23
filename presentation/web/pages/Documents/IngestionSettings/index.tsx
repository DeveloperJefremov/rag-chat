'use client';
import { Label } from '@/presentation/components/ui/label';
import { Input } from '@/presentation/components/ui/input';
import { ChunkingStrategy } from '@/domain/value-objects/ChunkingStrategy';

interface IngestionSettingsValue {
	strategy: ChunkingStrategy;
	chunkSize: number;
	overlap: number;
}

interface IngestionSettingsProps {
	value: IngestionSettingsValue;
	onChange: (v: IngestionSettingsValue) => void;
}

const STRATEGIES: ChunkingStrategy[] = ['FIXED', 'SENTENCE', 'PARAGRAPH', 'RECURSIVE'];

export function IngestionSettings({ value, onChange }: IngestionSettingsProps) {
	return (
		<div className='bg-muted/20 space-y-4 rounded-lg border p-4'>
			<h3 className='text-sm font-medium'>Ingestion Settings</h3>

			<div className='space-y-1.5'>
				<Label className='text-xs'>Chunking Strategy</Label>
				<div className='flex flex-wrap gap-2'>
					{STRATEGIES.map(s => (
						<button
							key={s}
							type='button'
							onClick={() => onChange({ ...value, strategy: s })}
							className={`rounded border px-3 py-1 text-xs transition-colors ${
								value.strategy === s
									? 'bg-primary text-primary-foreground border-primary'
									: 'border-input hover:bg-muted'
							}`}
						>
							{s}
						</button>
					))}
				</div>
			</div>

			<div className='grid grid-cols-2 gap-3'>
				<div className='space-y-1.5'>
					<Label htmlFor='chunk-size' className='text-xs'>
						Chunk Size (words)
					</Label>
					<Input
						id='chunk-size'
						type='number'
						min={50}
						max={2000}
						value={value.chunkSize}
						onChange={e => onChange({ ...value, chunkSize: Number(e.target.value) })}
						className='h-8 text-sm'
					/>
				</div>
				<div className='space-y-1.5'>
					<Label htmlFor='overlap' className='text-xs'>
						Overlap (words)
					</Label>
					<Input
						id='overlap'
						type='number'
						min={0}
						max={200}
						value={value.overlap}
						onChange={e => onChange({ ...value, overlap: Number(e.target.value) })}
						className='h-8 text-sm'
					/>
				</div>
			</div>
		</div>
	);
}
