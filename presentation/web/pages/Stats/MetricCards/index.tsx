import clsx from 'clsx';

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
			className={clsx(
				'rounded-[3px] px-1.5 py-px font-mono text-[10px]',
				positive
					? 'bg-[rgba(45,138,78,0.1)] text-[#2d8a4e]'
					: 'text-terracotta-600 bg-[rgba(200,90,44,0.1)]',
			)}
		>
			{positive ? '↑' : '↓'} {Math.abs(delta)}%
		</span>
	);
}

function StatCard({
	label,
	value,
	sub,
	accentClass,
	delay,
	delta,
}: {
	label: string;
	value: string;
	sub: string;
	accentClass?: string;
	delay: number;
	delta?: number;
}) {
	return (
		<div
			className='stat-card border-powder-200 bg-paper desk:p-5 flex flex-col gap-1.5 rounded-[10px] border p-4'
			style={{ animationDelay: `${delay}s` }}
		>
			<div className='text-smoke font-mono text-[9px] tracking-[0.15em] uppercase'>{label}</div>
			<div
				className={clsx(
					'desk:text-[32px] font-serif text-2xl leading-none font-light',
					accentClass ?? 'text-cobalt-800',
				)}
			>
				{value}
			</div>
			<div className='flex items-center gap-1.5'>
				<DeltaBadge delta={delta} />
				<span className='text-smoke font-mono text-[10px]'>{sub}</span>
			</div>
		</div>
	);
}

export function MetricCards({ kpi }: MetricCardsProps) {
	return (
		<div className='desk:grid-cols-4 desk:gap-4 grid grid-cols-2 gap-3'>
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
				accentClass='text-cobalt-700'
			/>
			<StatCard
				label='Total Cost'
				value={`$${kpi.totalCostUsd.toFixed(2)}`}
				sub='gemini-2.5-flash'
				delta={kpi.deltaCost}
				delay={0.1}
				accentClass='text-terracotta-600'
			/>
			<StatCard
				label='Citation Rate'
				value={`${Math.round(kpi.citationRate * 100)}%`}
				sub='responses with sources'
				delta={kpi.deltaCitation}
				delay={0.15}
				accentClass='text-cobalt-500'
			/>
		</div>
	);
}
