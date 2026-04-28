export interface DailyData {
	day: string;
	requests: number;
	latency: number;
	cost: number;
	citations: number;
}

function BarChart({
	data,
	color,
	height = 100,
}: {
	data: DailyData[];
	color: string;
	height?: number;
}) {
	const max = Math.max(...data.map(d => d.requests), 1);
	return (
		<div className='flex items-end gap-1.5 pt-2' style={{ height }}>
			{data.map((d, i) => {
				const h = Math.round((d.requests / max) * (height - 16));
				return (
					<div key={d.day} className='flex flex-1 flex-col items-center gap-1'>
						<div
							className='w-full rounded-[3px_3px_0_0] transition-[height] duration-500 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]'
							style={{
								height: h,
								background: color,
								opacity: i === data.length - 1 ? 0.5 : 1,
							}}
						/>
					</div>
				);
			})}
		</div>
	);
}

function LineChart({
	data,
	valueKey,
	color,
	height = 100,
}: {
	data: DailyData[];
	valueKey: 'latency' | 'citations';
	color: string;
	height?: number;
}) {
	const vals = data.map(d => d[valueKey]);
	const min = Math.min(...vals);
	const max = Math.max(...vals);
	const w = 100;
	const pts = vals.map((v, i) => {
		const x = vals.length > 1 ? (i / (vals.length - 1)) * w : 50;
		const y = height - ((v - min) / (max - min || 1)) * (height - 12) - 2;
		return `${x},${y}`;
	});
	const area = `M ${pts.join(' L ')} L ${w},${height} L 0,${height} Z`;
	const line = `M ${pts.join(' L ')}`;

	if (data.length < 2) return null;

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

function DayLabels({ data }: { data: DailyData[] }) {
	return (
		<div className='mt-1.5 flex justify-between'>
			{data.map(d => (
				<div key={d.day} className='text-smoke flex-1 text-center font-mono text-[9px]'>
					{d.day.split(' ')[1] ?? d.day}
				</div>
			))}
		</div>
	);
}

interface ChartsRowProps {
	data: DailyData[];
	totalRequests: number;
	avgLatencyMs: number;
}

export function ChartsRow({ data, totalRequests, avgLatencyMs }: ChartsRowProps) {
	return (
		<div className='desk:grid-cols-2 desk:gap-4 grid grid-cols-1 gap-4'>
			<div className='border-powder-200 bg-paper min-w-0 animate-[fade-up_0.4s_ease_0.1s_both] rounded-[10px] border px-5 py-4'>
				<div className='mb-4 flex items-start justify-between'>
					<div>
						<div className='text-smoke mb-1 font-mono text-[9px] tracking-[0.15em] uppercase'>
							Requests / day
						</div>
						<div className='flex items-baseline gap-1.5'>
							<span className='text-cobalt-800 font-serif text-[22px] font-light'>
								{totalRequests}
							</span>
							<span className='text-smoke font-mono text-[10px]'>total</span>
						</div>
					</div>
					<div className='flex items-center gap-1.5'>
						<div className='bg-cobalt-700 h-2 w-2 rounded-[2px]' />
						<span className='text-smoke font-mono text-[10px]'>queries</span>
					</div>
				</div>
				<BarChart data={data} color='var(--cobalt-700)' height={100} />
				<DayLabels data={data} />
			</div>

			<div className='border-powder-200 bg-paper min-w-0 animate-[fade-up_0.4s_ease_0.15s_both] rounded-[10px] border px-5 py-4'>
				<div className='mb-4 flex items-start justify-between'>
					<div>
						<div className='text-smoke mb-1 font-mono text-[9px] tracking-[0.15em] uppercase'>
							Avg Latency (ms)
						</div>
						<div className='flex items-baseline gap-1.5'>
							<span className='text-cobalt-800 font-serif text-[22px] font-light'>
								{avgLatencyMs}
								<span className='text-sm'>ms</span>
							</span>
						</div>
					</div>
					<div className='flex items-center gap-1.5'>
						<div className='bg-powder-600 h-2 w-2 rounded-[2px]' />
						<span className='text-smoke font-mono text-[10px]'>p50</span>
					</div>
				</div>
				<LineChart data={data} valueKey='latency' color='var(--powder-600)' height={100} />
				<DayLabels data={data} />
			</div>
		</div>
	);
}
