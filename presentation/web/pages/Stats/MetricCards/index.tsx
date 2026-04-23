import { Card } from '@/presentation/components/ui/card';

interface MetricCardsProps {
	totalRequests: number;
	avgLatencyMs: number;
	p95LatencyMs: number;
	totalCostUsd: number;
	citationRate: number;
}

export function MetricCards(props: MetricCardsProps) {
	const metrics = [
		{ label: 'Total Requests', value: props.totalRequests.toString() },
		{ label: 'Avg Latency', value: `${Math.round(props.avgLatencyMs)}ms` },
		{ label: 'P95 Latency', value: `${Math.round(props.p95LatencyMs)}ms` },
		{ label: 'Total Cost', value: `$${props.totalCostUsd.toFixed(4)}` },
		{ label: 'Citation Rate', value: `${(props.citationRate * 100).toFixed(1)}%` },
	];

	return (
		<div className='grid grid-cols-2 gap-3 md:grid-cols-5'>
			{metrics.map(m => (
				<Card key={m.label} className='p-4'>
					<p className='text-muted-foreground text-xs'>{m.label}</p>
					<p className='mt-1 text-xl font-bold tabular-nums'>{m.value}</p>
				</Card>
			))}
		</div>
	);
}
