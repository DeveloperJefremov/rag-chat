interface KpiData {
	requests: number;
	avgLatencyMs: number;
	totalCostUsd: number;
	citationRate: number;
	deltaRequests?: number;
	deltaLatency?: number;
	deltaCost?: number;
	deltaCitation?: number;
}

interface MetricCardsProps {
	kpi: KpiData;
}

function DeltaBadge({ delta }: { delta?: number }) {
	if (delta === undefined) return null;
	const positive = delta > 0;
	return (
		<span
			style={{
				fontFamily: 'var(--font-jetbrains-mono), monospace',
				fontSize: 10,
				color: positive ? '#2d8a4e' : 'var(--terracotta-600)',
				background: positive ? 'rgba(45,138,78,0.1)' : 'rgba(200,90,44,0.1)',
				padding: '1px 6px',
				borderRadius: 3,
			}}
		>
			{positive ? '↑' : '↓'} {Math.abs(delta)}%
		</span>
	);
}

function StatCard({
	label,
	value,
	sub,
	accent,
	delay,
	delta,
}: {
	label: string;
	value: string;
	sub: string;
	accent?: string;
	delay: number;
	delta?: number;
}) {
	return (
		<div
			className='stat-card'
			style={{
				background: 'var(--paper)',
				border: '1px solid var(--powder-200)',
				borderRadius: 10,
				padding: '22px 24px',
				display: 'flex',
				flexDirection: 'column',
				gap: 6,
				animationDelay: `${delay}s`,
			}}
		>
			<div
				style={{
					fontFamily: 'var(--font-jetbrains-mono), monospace',
					fontSize: 9,
					letterSpacing: '0.15em',
					textTransform: 'uppercase',
					color: 'var(--smoke)',
				}}
			>
				{label}
			</div>
			<div
				style={{
					fontFamily: 'var(--font-fraunces), serif',
					fontSize: 32,
					fontWeight: 300,
					color: accent ?? 'var(--cobalt-800)',
					lineHeight: 1,
				}}
			>
				{value}
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
				<DeltaBadge delta={delta} />
				<span
					style={{
						fontFamily: 'var(--font-jetbrains-mono), monospace',
						fontSize: 10,
						color: 'var(--smoke)',
					}}
				>
					{sub}
				</span>
			</div>
		</div>
	);
}

export function MetricCards({ kpi }: MetricCardsProps) {
	return (
		<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
			<StatCard
				label='Total Requests'
				value={String(kpi.requests)}
				sub='vs prior period'
				delta={kpi.deltaRequests}
				delay={0}
			/>
			<StatCard
				label='Avg Latency'
				value={`${kpi.avgLatencyMs}ms`}
				sub='p50 · all models'
				delta={kpi.deltaLatency}
				delay={0.05}
				accent='var(--cobalt-700)'
			/>
			<StatCard
				label='Total Cost'
				value={`$${kpi.totalCostUsd.toFixed(2)}`}
				sub='gemini-2.5-flash'
				delta={kpi.deltaCost}
				delay={0.1}
				accent='var(--terracotta-600)'
			/>
			<StatCard
				label='Citation Rate'
				value={`${Math.round(kpi.citationRate * 100)}%`}
				sub='responses with sources'
				delta={kpi.deltaCitation}
				delay={0.15}
				accent='var(--cobalt-500)'
			/>
		</div>
	);
}
