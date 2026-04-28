import type { DailyData } from '../ChartsRow';

function LineChart({
	data,
	color,
	height = 80,
}: {
	data: DailyData[];
	color: string;
	height?: number;
}) {
	const vals = data.map(d => d.citations);
	const min = Math.min(...vals);
	const max = Math.max(...vals);
	const w = 100;

	if (data.length < 2) return null;

	const pts = vals.map((v, i) => {
		const x = (i / (vals.length - 1)) * w;
		const y = height - ((v - min) / (max - min || 1)) * (height - 12) - 2;
		return `${x},${y}`;
	});
	const area = `M ${pts.join(' L ')} L ${w},${height} L 0,${height} Z`;
	const line = `M ${pts.join(' L ')}`;

	return (
		<svg
			width='100%'
			height={height}
			viewBox={`0 0 ${w} ${height}`}
			preserveAspectRatio='none'
			className='overflow-visible'
		>
			<path d={area} fill={color} fillOpacity='0.12' />
			<path d={line} fill='none' stroke={color} strokeWidth='1.5' />
			{vals.map((v, i) => {
				const x = (i / (vals.length - 1)) * w;
				const y = height - ((v - min) / (max - min || 1)) * (height - 12) - 2;
				return <circle key={i} cx={x} cy={y} r='2.5' fill={color} />;
			})}
		</svg>
	);
}

interface CitationModelProps {
	data: DailyData[];
}

export function CitationModel({ data }: CitationModelProps) {
	const totalReqs = data.reduce((s, d) => s + d.requests, 0);
	return (
		<div className='desk:grid-cols-2 desk:gap-4 grid grid-cols-1 gap-4'>
			<div className='border-powder-200 bg-paper min-w-0 animate-[fade-up_0.4s_ease_0.2s_both] rounded-[10px] border px-5 py-4'>
				<div className='text-smoke mb-3 font-mono text-[9px] tracking-[0.15em] uppercase'>
					Citation Rate by Day
				</div>
				<LineChart data={data} color='var(--terracotta-500)' height={80} />
				<div className='mt-1.5 flex justify-between'>
					{data.map(d => (
						<div key={d.day} className='flex-1 text-center'>
							<div className='text-smoke font-mono text-[9px]'>{d.day.split(' ')[1] ?? d.day}</div>
							<div className='text-terracotta-600 font-mono text-[10px] font-medium'>
								{Math.round(d.citations * 100)}%
							</div>
						</div>
					))}
				</div>
			</div>

			<div className='border-powder-200 bg-paper min-w-0 animate-[fade-up_0.4s_ease_0.25s_both] rounded-[10px] border px-5 py-4'>
				<div className='text-smoke mb-4 font-mono text-[9px] tracking-[0.15em] uppercase'>
					Model Usage
				</div>
				<div className='mb-3'>
					<div className='mb-1.5 flex justify-between'>
						<span className='text-ink font-mono text-[11px]'>gemini-2.5-flash</span>
						<span className='text-smoke font-mono text-[11px]'>{totalReqs} req · 100%</span>
					</div>
					<div className='bg-powder-100 h-1.5 overflow-hidden rounded-[3px]'>
						<div className='bg-cobalt-700 h-full w-full rounded-[3px] transition-[width] duration-700 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]' />
					</div>
				</div>
			</div>
		</div>
	);
}
