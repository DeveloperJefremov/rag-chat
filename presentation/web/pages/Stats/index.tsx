'use client';
import { useEffect, useState } from 'react';
import { MetricCards } from './MetricCards';
import { QueryLogTable } from './QueryLogTable';
import { InsightBar } from './InsightBar';
import { llmOpsApi } from '@/client/infrastructure/container';
import { LLMOpsStats } from '@/client/application/api/ILLMOpsApi';

export function StatsPage() {
	const [data, setData] = useState<LLMOpsStats | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		llmOpsApi
			.getStats()
			.then(setData)
			.catch(() => setError('Failed to load stats. Admin access required.'));
	}, []);

	if (error) {
		return <div className='text-muted-foreground p-6 text-sm'>{error}</div>;
	}

	if (!data) {
		return <div className='text-muted-foreground p-6 text-sm'>Loading LLMOps data…</div>;
	}

	return (
		<div className='max-w-5xl space-y-6 p-6'>
			<div>
				<h2 className='text-xl font-semibold'>LLMOps Dashboard</h2>
				<p className='text-muted-foreground mt-0.5 text-sm'>
					Observability — latency, cost, citation quality
				</p>
			</div>

			<MetricCards
				totalRequests={data.totalRequests}
				avgLatencyMs={data.avgLatencyMs}
				p95LatencyMs={data.p95LatencyMs}
				totalCostUsd={data.totalCostUsd}
				citationRate={data.citationRate}
			/>

			<InsightBar logs={data.logs ?? []} />

			<div>
				<h3 className='mb-3 text-sm font-medium'>Query Log</h3>
				<QueryLogTable logs={data.logs ?? []} />
			</div>
		</div>
	);
}
