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

interface CitationModelProps {
	data: DailyData[];
}

export function CitationModel({ data }: CitationModelProps) {
	return (
		<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
			{/* Citation rate by day */}
			<div
				style={{
					background: 'var(--paper)',
					border: '1px solid var(--powder-200)',
					borderRadius: 10,
					padding: '18px 20px',
					animation: 'fade-up 0.4s ease 0.2s both',
				}}
			>
				<div
					style={{
						fontFamily: 'var(--font-jetbrains-mono), monospace',
						fontSize: 9,
						letterSpacing: '0.15em',
						textTransform: 'uppercase',
						color: 'var(--smoke)',
						marginBottom: 12,
					}}
				>
					Citation Rate by Day
				</div>
				<LineChart data={data} color='var(--terracotta-500)' height={80} />
				<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
					{data.map(d => (
						<div key={d.day} style={{ flex: 1, textAlign: 'center' }}>
							<div
								style={{
									fontFamily: 'var(--font-jetbrains-mono), monospace',
									fontSize: 9,
									color: 'var(--smoke)',
								}}
							>
								{d.day.split(' ')[1] ?? d.day}
							</div>
							<div
								style={{
									fontFamily: 'var(--font-jetbrains-mono), monospace',
									fontSize: 10,
									color: 'var(--terracotta-600)',
									fontWeight: 500,
								}}
							>
								{Math.round(d.citations * 100)}%
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Model usage */}
			<div
				style={{
					background: 'var(--paper)',
					border: '1px solid var(--powder-200)',
					borderRadius: 10,
					padding: '18px 20px',
					animation: 'fade-up 0.4s ease 0.25s both',
				}}
			>
				<div
					style={{
						fontFamily: 'var(--font-jetbrains-mono), monospace',
						fontSize: 9,
						letterSpacing: '0.15em',
						textTransform: 'uppercase',
						color: 'var(--smoke)',
						marginBottom: 16,
					}}
				>
					Model Usage
				</div>
				{[
					{
						model: 'gemini-2.5-flash',
						pct: 100,
						reqs: data.reduce((s, d) => s + d.requests, 0),
						color: 'var(--cobalt-700)',
					},
				].map(m => (
					<div key={m.model} style={{ marginBottom: 12 }}>
						<div
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								marginBottom: 5,
							}}
						>
							<span
								style={{
									fontFamily: 'var(--font-jetbrains-mono), monospace',
									fontSize: 11,
									color: 'var(--ink)',
								}}
							>
								{m.model}
							</span>
							<span
								style={{
									fontFamily: 'var(--font-jetbrains-mono), monospace',
									fontSize: 11,
									color: 'var(--smoke)',
								}}
							>
								{m.reqs} req · {m.pct}%
							</span>
						</div>
						<div
							style={{
								height: 6,
								background: 'var(--powder-100)',
								borderRadius: 3,
								overflow: 'hidden',
							}}
						>
							<div
								style={{
									height: '100%',
									width: `${m.pct}%`,
									background: m.color,
									borderRadius: 3,
									transition: 'width 0.6s cubic-bezier(0.2,0.8,0.2,1)',
								}}
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
