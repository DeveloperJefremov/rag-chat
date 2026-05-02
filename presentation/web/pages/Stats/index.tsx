'use client';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { llmOpsApi } from '@/client/infrastructure/container';
import { UnauthenticatedError } from '@/client/infrastructure/http/apiFetch';
import { toast } from '@/client/stores/toastStore';
import { LLMOpsLogEntry, LLMOpsStats } from '@/client/application/api/ILLMOpsApi';
import { MobileMenuButton } from '@/presentation/web/components/MobileMenuButton';
import { ToggleChip } from '@/presentation/web/components/ui/ToggleChip';
import { Skeleton } from '@/presentation/components/ui/skeleton';
import { MetricCards } from './MetricCards';
import { ChartsRow, DailyData } from './ChartsRow';
import { CitationModel } from './CitationModel';
import { QueryLogTable } from './QueryLogTable';

type TimeRange = '1d' | '7d' | '30d';

function filterByRange(logs: LLMOpsLogEntry[], range: TimeRange): LLMOpsLogEntry[] {
	const days = range === '1d' ? 1 : range === '7d' ? 7 : 30;
	const cutoff = Date.now() - days * 86_400_000;
	return logs.filter(l => new Date(l.createdAt).getTime() >= cutoff);
}

function groupByDay(logs: LLMOpsLogEntry[]): DailyData[] {
	const map = new Map<
		string,
		{ isoDate: string; requests: number; latencies: number[]; cost: number; citations: number[] }
	>();

	for (const log of logs) {
		const d = new Date(log.createdAt);
		const iso = d.toISOString().slice(0, 10);
		if (!map.has(iso))
			map.set(iso, { isoDate: iso, requests: 0, latencies: [], cost: 0, citations: [] });
		const e = map.get(iso)!;
		e.requests++;
		e.latencies.push(log.latencyMs);
		e.cost += log.estimatedCostUsd;
		e.citations.push(log.hasCitation ? 1 : 0);
	}

	return Array.from(map.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, v]) => {
			const d = new Date(v.isoDate);
			const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			return {
				day: label,
				requests: v.requests,
				latency: v.latencies.length
					? Math.round(v.latencies.reduce((s, x) => s + x, 0) / v.latencies.length)
					: 0,
				cost: v.cost,
				citations: v.citations.length
					? v.citations.reduce((s, x) => s + x, 0) / v.citations.length
					: 0,
			};
		});
}

function computeDelta(current: number, prior: number): number | undefined {
	if (!prior) return undefined;
	return Math.round(((current - prior) / prior) * 100);
}

function buildKpi(logs: LLMOpsLogEntry[]) {
	if (!logs.length) return null;
	const sorted = [...logs].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
	const mid = Math.floor(sorted.length / 2);
	const prior = sorted.slice(0, mid);
	const current = sorted.slice(mid);

	const avg = (arr: LLMOpsLogEntry[], fn: (l: LLMOpsLogEntry) => number) =>
		arr.length ? arr.reduce((s, l) => s + fn(l), 0) / arr.length : 0;

	const requests = logs.length;
	const avgLatencyMs = Math.round(avg(logs, l => l.latencyMs));
	const totalCostUsd = logs.reduce((s, l) => s + l.estimatedCostUsd, 0);
	const citationRate = logs.filter(l => l.hasCitation).length / requests;

	const pReqs = prior.length;
	const cReqs = current.length;
	const pLatency = Math.round(avg(prior, l => l.latencyMs));
	const cLatency = Math.round(avg(current, l => l.latencyMs));
	const pCost = prior.reduce((s, l) => s + l.estimatedCostUsd, 0);
	const cCost = current.reduce((s, l) => s + l.estimatedCostUsd, 0);
	const pCitation = prior.length ? prior.filter(l => l.hasCitation).length / prior.length : 0;
	const cCitation = current.length ? current.filter(l => l.hasCitation).length / current.length : 0;

	return {
		requests,
		avgLatencyMs,
		totalCostUsd,
		citationRate,
		deltaRequests: sorted.length >= 4 ? computeDelta(cReqs, pReqs) : undefined,
		deltaLatency: sorted.length >= 4 ? computeDelta(cLatency, pLatency) : undefined,
		deltaCost: sorted.length >= 4 ? computeDelta(cCost, pCost) : undefined,
		deltaCitation:
			sorted.length >= 4
				? computeDelta(Math.round(cCitation * 100), Math.round(pCitation * 100))
				: undefined,
	};
}

function buildDateLabel(logs: LLMOpsLogEntry[], range: TimeRange): string {
	if (!logs.length)
		return `Last ${range === '1d' ? '24 hours' : range === '7d' ? '7 days' : '30 days'}`;
	const dates = logs.map(l => new Date(l.createdAt).getTime());
	const min = new Date(Math.min(...dates));
	const max = new Date(Math.max(...dates));
	const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	const days = range === '1d' ? '1 day' : range === '7d' ? '7 days' : '30 days';
	return `${fmt(min)} — ${fmt(max)}, ${max.getFullYear()} · ${days}`;
}

function StatsSkeleton() {
	return (
		<div
			className='desk:px-7 desk:py-6 desk:gap-8 flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5'
			aria-busy='true'
			aria-live='polite'
			aria-label='Loading observability data'
		>
			<div className='desk:grid-cols-4 desk:gap-4 grid grid-cols-2 gap-3'>
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={i}
						className='border-powder-200 bg-paper desk:p-5 flex flex-col gap-1.5 rounded-[10px] border p-4'
					>
						<Skeleton className='h-2.5 w-20' />
						<Skeleton className='desk:h-8 mt-1 h-7 w-24' />
						<div className='flex items-center gap-1.5'>
							<Skeleton className='h-3 w-10' />
							<Skeleton className='h-2.5 w-20' />
						</div>
					</div>
				))}
			</div>

			<div className='desk:grid-cols-2 desk:gap-4 grid grid-cols-1 gap-4'>
				{Array.from({ length: 2 }).map((_, i) => (
					<div
						key={i}
						className='border-powder-200 bg-paper min-w-0 rounded-[10px] border px-5 py-4'
					>
						<div className='mb-4 flex items-start justify-between'>
							<div className='flex flex-col gap-1.5'>
								<Skeleton className='h-2.5 w-24' />
								<Skeleton className='h-5 w-16' />
							</div>
							<Skeleton className='h-2.5 w-14' />
						</div>
						<Skeleton className='h-[100px] w-full rounded-md' />
						<div className='mt-1.5 flex justify-between gap-2'>
							{Array.from({ length: 7 }).map((_, j) => (
								<Skeleton key={j} className='h-2 flex-1' />
							))}
						</div>
					</div>
				))}
			</div>

			<div className='border-powder-200 bg-paper overflow-hidden rounded-[10px] border'>
				<div className='border-powder-200 flex items-center justify-between border-b px-5 py-3.5'>
					<Skeleton className='h-2.5 w-28' />
					<Skeleton className='h-2.5 w-20' />
				</div>
				<div className='bg-sand border-powder-200 grid grid-cols-[3fr_90px_180px_60px_80px] gap-4 border-b px-5 py-2'>
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={i} className='h-2.5 w-12' />
					))}
				</div>
				{Array.from({ length: 5 }).map((_, i) => (
					<div
						key={i}
						className={clsx(
							'grid grid-cols-[3fr_90px_180px_60px_80px] items-center gap-4 px-5 py-2.5',
							i < 4 && 'border-powder-200 border-b',
						)}
					>
						<Skeleton className='h-3 w-4/5' />
						<Skeleton className='h-3 w-12' />
						<Skeleton className='h-3 w-24' />
						<Skeleton className='h-1.5 w-10' />
						<Skeleton className='h-3 w-14' />
					</div>
				))}
			</div>
		</div>
	);
}

export function StatsPage() {
	const [data, setData] = useState<LLMOpsStats | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [timeRange, setTimeRange] = useState<TimeRange>('7d');
	const showCost = true;

	useEffect(() => {
		llmOpsApi
			.getStats()
			.then(setData)
			.catch(e => {
				if (e instanceof UnauthenticatedError) return;
				const message = 'Failed to load stats. Admin access required.';
				toast.error('Stats unavailable', message);
				setError(message);
			});
	}, []);

	const filteredLogs = useMemo(
		() => (data ? filterByRange(data.logs, timeRange) : []),
		[data, timeRange],
	);

	const dailyData = useMemo(() => groupByDay(filteredLogs), [filteredLogs]);

	const kpi = useMemo(() => buildKpi(filteredLogs), [filteredLogs]);

	const dateLabel = useMemo(
		() => buildDateLabel(filteredLogs, timeRange),
		[filteredLogs, timeRange],
	);

	if (error) {
		return (
			<div className='flex h-full items-center justify-center'>
				<p className='text-smoke font-mono text-[13px]'>{error}</p>
			</div>
		);
	}

	const loading = !data;

	return (
		<div className='bg-paper flex h-full flex-col overflow-hidden'>
			<div className='border-powder-200 bg-paper desk:px-7 desk:py-[18px] flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3'>
				<div className='flex min-w-0 items-center gap-3'>
					<MobileMenuButton />
					<div className='min-w-0'>
						<h1 className='text-cobalt-800 desk:text-[22px] m-0 font-serif text-xl font-light tracking-[-0.01em] italic'>
							Observability
						</h1>
						{loading ? (
							<Skeleton className='mt-1 h-2.5 w-44' />
						) : (
							<div className='text-smoke mt-0.5 font-mono text-[10px] tracking-[0.1em] uppercase'>
								{dateLabel}
							</div>
						)}
					</div>
				</div>

				<div className='flex gap-1.5'>
					{(['1d', '7d', '30d'] as TimeRange[]).map(r => (
						<ToggleChip
							key={r}
							active={timeRange === r}
							onClick={() => setTimeRange(r)}
							className='px-3 py-1.5 font-mono tracking-[0.05em]'
						>
							{r}
						</ToggleChip>
					))}
				</div>
			</div>

			{loading ? (
				<StatsSkeleton />
			) : kpi ? (
				<div className='desk:px-7 desk:py-6 desk:gap-8 flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5'>
					<MetricCards kpi={kpi} />

					{dailyData.length >= 2 && (
						<>
							<ChartsRow
								data={dailyData}
								totalRequests={kpi.requests}
								avgLatencyMs={kpi.avgLatencyMs}
							/>
							<CitationModel data={dailyData} />
						</>
					)}

					<QueryLogTable logs={filteredLogs.slice().reverse()} showCost={showCost} />
				</div>
			) : (
				<div className='flex flex-1 items-center justify-center'>
					<p className='text-smoke font-mono text-[13px]'>No data for this period.</p>
				</div>
			)}
		</div>
	);
}
