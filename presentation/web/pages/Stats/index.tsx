'use client';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { llmOpsApi } from '@/client/infrastructure/container';
import { LLMOpsLogEntry, LLMOpsStats } from '@/client/application/api/ILLMOpsApi';
import { useSidebarStore } from '@/client/stores/sidebarStore';
import { MobileMenuButton } from '@/presentation/web/components/MobileMenuButton';
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

export function StatsPage() {
	const [data, setData] = useState<LLMOpsStats | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [timeRange, setTimeRange] = useState<TimeRange>('7d');
	const showCost = true;
	const setTodayStats = useSidebarStore(s => s.setTodayStats);

	useEffect(() => {
		llmOpsApi
			.getStats()
			.then(setData)
			.catch(() => setError('Failed to load stats. Admin access required.'));
	}, []);

	useEffect(() => {
		if (!data?.logs.length) return;
		const today = new Date().toISOString().slice(0, 10);
		const todayLogs = data.logs.filter(l => l.createdAt.startsWith(today));
		if (!todayLogs.length) return;
		const requests = todayLogs.length;
		const avgLatencyMs = Math.round(todayLogs.reduce((s, l) => s + l.latencyMs, 0) / requests);
		const citationRate = todayLogs.filter(l => l.hasCitation).length / requests;
		setTodayStats({ requests, avgLatencyMs, citationRate });
	}, [data, setTodayStats]);

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

	if (!data) {
		return (
			<div className='flex h-full items-center justify-center'>
				<p className='text-smoke font-mono text-[13px]'>Loading LLMOps data…</p>
			</div>
		);
	}

	return (
		<div className='bg-paper flex h-full flex-col overflow-hidden'>
			<div className='border-powder-200 bg-paper desk:px-7 desk:py-[18px] flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3'>
				<div className='flex min-w-0 items-center gap-3'>
					<MobileMenuButton />
					<div className='min-w-0'>
						<h1 className='text-cobalt-800 desk:text-[22px] m-0 font-serif text-xl font-light tracking-[-0.01em] italic'>
							Observability
						</h1>
						<div className='text-smoke mt-0.5 font-mono text-[10px] tracking-[0.1em] uppercase'>
							{dateLabel}
						</div>
					</div>
				</div>

				<div className='flex gap-1.5'>
					{(['1d', '7d', '30d'] as TimeRange[]).map(r => (
						<button
							key={r}
							type='button'
							onClick={() => setTimeRange(r)}
							className={clsx(
								'cursor-pointer rounded-md border px-3 py-1.5 font-mono text-[11px] tracking-[0.05em] transition-colors',
								timeRange === r
									? 'border-cobalt-800 bg-cobalt-800 text-paper'
									: 'border-powder-300 bg-paper text-smoke hover:border-cobalt-700',
							)}
						>
							{r}
						</button>
					))}
				</div>
			</div>

			{kpi ? (
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

					<QueryLogTable logs={filteredLogs.slice().reverse().slice(0, 20)} showCost={showCost} />
				</div>
			) : (
				<div className='flex flex-1 items-center justify-center'>
					<p className='text-smoke font-mono text-[13px]'>No data for this period.</p>
				</div>
			)}
		</div>
	);
}
