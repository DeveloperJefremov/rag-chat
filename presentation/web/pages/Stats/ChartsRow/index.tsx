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
		<div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, paddingTop: 8 }}>
			{data.map((d, i) => {
				const h = Math.round((d.requests / max) * (height - 16));
				return (
					<div
						key={d.day}
						style={{
							flex: 1,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							gap: 4,
						}}
					>
						<div
							style={{
								width: '100%',
								height: h,
								background: color,
								borderRadius: '3px 3px 0 0',
								opacity: i === data.length - 1 ? 0.5 : 1,
								transition: 'height 0.5s cubic-bezier(0.2,0.8,0.2,1)',
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
			style={{ overflow: 'visible' }}
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
		<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
			{data.map(d => (
				<div
					key={d.day}
					style={{
						fontFamily: 'var(--font-jetbrains-mono), monospace',
						fontSize: 9,
						color: 'var(--smoke)',
						textAlign: 'center',
						flex: 1,
					}}
				>
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
		<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
			{/* Requests bar chart */}
			<div
				style={{
					background: 'var(--paper)',
					border: '1px solid var(--powder-200)',
					borderRadius: 10,
					padding: '18px 20px',
					animation: 'fade-up 0.4s ease 0.1s both',
				}}
			>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'flex-start',
						marginBottom: 16,
					}}
				>
					<div>
						<div
							style={{
								fontFamily: 'var(--font-jetbrains-mono), monospace',
								fontSize: 9,
								letterSpacing: '0.15em',
								textTransform: 'uppercase',
								color: 'var(--smoke)',
								marginBottom: 4,
							}}
						>
							Requests / day
						</div>
						<div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
							<span
								style={{
									fontFamily: 'var(--font-fraunces), serif',
									fontSize: 22,
									fontWeight: 300,
									color: 'var(--cobalt-800)',
								}}
							>
								{totalRequests}
							</span>
							<span
								style={{
									fontFamily: 'var(--font-jetbrains-mono), monospace',
									fontSize: 10,
									color: 'var(--smoke)',
								}}
							>
								total
							</span>
						</div>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<div
							style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--cobalt-700)' }}
						/>
						<span
							style={{
								fontFamily: 'var(--font-jetbrains-mono), monospace',
								fontSize: 10,
								color: 'var(--smoke)',
							}}
						>
							queries
						</span>
					</div>
				</div>
				<BarChart data={data} color='var(--cobalt-700)' height={100} />
				<DayLabels data={data} />
			</div>

			{/* Latency line chart */}
			<div
				style={{
					background: 'var(--paper)',
					border: '1px solid var(--powder-200)',
					borderRadius: 10,
					padding: '18px 20px',
					animation: 'fade-up 0.4s ease 0.15s both',
				}}
			>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'flex-start',
						marginBottom: 16,
					}}
				>
					<div>
						<div
							style={{
								fontFamily: 'var(--font-jetbrains-mono), monospace',
								fontSize: 9,
								letterSpacing: '0.15em',
								textTransform: 'uppercase',
								color: 'var(--smoke)',
								marginBottom: 4,
							}}
						>
							Avg Latency (ms)
						</div>
						<div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
							<span
								style={{
									fontFamily: 'var(--font-fraunces), serif',
									fontSize: 22,
									fontWeight: 300,
									color: 'var(--cobalt-800)',
								}}
							>
								{avgLatencyMs}
								<span style={{ fontSize: 14 }}>ms</span>
							</span>
						</div>
					</div>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
						<div
							style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--powder-600)' }}
						/>
						<span
							style={{
								fontFamily: 'var(--font-jetbrains-mono), monospace',
								fontSize: 10,
								color: 'var(--smoke)',
							}}
						>
							p50
						</span>
					</div>
				</div>
				<LineChart data={data} valueKey='latency' color='var(--powder-600)' height={100} />
				<DayLabels data={data} />
			</div>
		</div>
	);
}
