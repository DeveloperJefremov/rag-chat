interface InsightBarProps {
	logs: Array<{ chunkingStrategy: string; latencyMs: number; hasCitation: boolean }>;
}

export function InsightBar({ logs }: InsightBarProps) {
	if (logs.length < 3) return null;

	const byStrategy = logs.reduce<Record<string, { latencies: number[]; citations: number[] }>>(
		(acc, log) => {
			if (!acc[log.chunkingStrategy]) acc[log.chunkingStrategy] = { latencies: [], citations: [] };
			acc[log.chunkingStrategy].latencies.push(log.latencyMs);
			acc[log.chunkingStrategy].citations.push(log.hasCitation ? 1 : 0);
			return acc;
		},
		{},
	);

	const insights = Object.entries(byStrategy)
		.filter(([, v]) => v.latencies.length > 0)
		.map(([strategy, v]) => ({
			strategy,
			avgLatency: Math.round(v.latencies.reduce((s, x) => s + x, 0) / v.latencies.length),
			citationRate: v.citations.reduce((s, x) => s + x, 0) / v.citations.length,
		}));

	const bestCitation = [...insights].sort((a, b) => b.citationRate - a.citationRate)[0];
	const fastestStrategy = [...insights].sort((a, b) => a.avgLatency - b.avgLatency)[0];

	return (
		<div className='rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-800 dark:bg-blue-950/20'>
			<p className='mb-1 font-medium text-blue-700 dark:text-blue-300'>Insights</p>
			<ul className='space-y-0.5 text-xs text-blue-600 dark:text-blue-400'>
				{bestCitation && (
					<li>
						<strong>{bestCitation.strategy}</strong> has the highest citation rate (
						{(bestCitation.citationRate * 100).toFixed(0)}%)
					</li>
				)}
				{fastestStrategy && fastestStrategy.strategy !== bestCitation?.strategy && (
					<li>
						<strong>{fastestStrategy.strategy}</strong> is fastest (avg {fastestStrategy.avgLatency}
						ms)
					</li>
				)}
			</ul>
		</div>
	);
}
