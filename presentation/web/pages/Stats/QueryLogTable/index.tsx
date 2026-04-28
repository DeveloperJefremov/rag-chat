import clsx from 'clsx';
import { LLMOpsLogEntry } from '@/client/application/api/ILLMOpsApi';

interface QueryLogTableProps {
	logs: LLMOpsLogEntry[];
	showCost: boolean;
}

function CitationDots({ count }: { count: number }) {
	return (
		<div className='flex gap-[3px]'>
			{Array.from({ length: Math.min(count, 5) }).map((_, j) => (
				<div
					key={j}
					className='bg-terracotta-500 h-1.5 w-1.5 rounded-[1px]'
					style={{ opacity: 0.7 + j * 0.06 }}
				/>
			))}
		</div>
	);
}

export function QueryLogTable({ logs, showCost }: QueryLogTableProps) {
	if (logs.length === 0) {
		return (
			<div className='border-powder-200 bg-paper rounded-[10px] border px-5 py-10 text-center'>
				<p className='text-smoke font-mono text-xs'>No queries yet.</p>
			</div>
		);
	}

	const today = new Date().toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});

	const cols = showCost ? '3fr 90px 180px 60px 80px' : '3fr 90px 180px 60px';
	const headers = ['Query', 'Latency', 'Model', 'Cit.', ...(showCost ? ['Cost'] : [])];

	return (
		<div className='border-powder-200 bg-paper animate-[fade-up_0.4s_ease_0.3s_both] overflow-hidden rounded-[10px] border'>
			<div className='border-powder-200 flex items-center justify-between border-b px-5 py-3.5'>
				<div className='text-smoke font-mono text-[9px] tracking-[0.15em] uppercase'>
					Recent Queries
				</div>
				<div className='text-terracotta-600 font-mono text-[10px]'>{today}</div>
			</div>

			<div className='overflow-x-auto'>
				<div className='min-w-[640px]'>
					<div
						className='bg-sand border-powder-200 grid border-b px-5 py-2'
						style={{ gridTemplateColumns: cols }}
					>
						{headers.map(h => (
							<div key={h} className='text-smoke font-mono text-[9px] tracking-[0.12em] uppercase'>
								{h}
							</div>
						))}
					</div>

					{logs.map((log, i) => {
						const latencyClass =
							log.latencyMs < 600
								? 'text-[#2d8a4e]'
								: log.latencyMs < 800
									? 'text-cobalt-700'
									: 'text-terracotta-600';

						const citationCount = log.hasCitation
							? Math.max(1, Math.round(log.promptTokens / 800))
							: 0;

						return (
							<div
								key={log.id}
								className={clsx(
									'grid items-center px-5 py-2.5',
									i < logs.length - 1 && 'border-powder-200 border-b',
								)}
								style={{ gridTemplateColumns: cols }}
							>
								<div className='text-ink truncate pr-3 text-[13px]' title={log.query}>
									{log.query}
								</div>
								<div className={clsx('font-mono text-xs font-medium', latencyClass)}>
									{log.latencyMs}ms
								</div>
								<div className='text-smoke font-mono text-[11px]'>gemini-2.5-flash</div>
								<CitationDots count={citationCount} />
								{showCost && (
									<div className='text-smoke font-mono text-[11px]'>
										${log.estimatedCostUsd.toFixed(4)}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
