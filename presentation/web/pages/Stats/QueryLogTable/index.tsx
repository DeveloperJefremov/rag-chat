import { LLMOpsLogEntry } from '@/client/application/api/ILLMOpsApi';

interface QueryLogTableProps {
	logs: LLMOpsLogEntry[];
}

export function QueryLogTable({ logs }: QueryLogTableProps) {
	if (logs.length === 0) {
		return <p className='text-muted-foreground py-6 text-center text-sm'>No queries yet.</p>;
	}

	return (
		<div className='overflow-hidden rounded-lg border'>
			<table className='w-full text-xs'>
				<thead className='bg-muted/50'>
					<tr>
						{['Query', 'Latency', 'Cost', 'Strategy', 'Reranked', 'Cited'].map(h => (
							<th key={h} className='text-muted-foreground px-3 py-2.5 text-left font-medium'>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody className='divide-y'>
					{logs.map(log => (
						<tr key={log.id} className='hover:bg-muted/20'>
							<td className='max-w-[200px] truncate px-3 py-2.5' title={log.query}>
								{log.query}
							</td>
							<td className='px-3 py-2.5 tabular-nums'>{log.latencyMs}ms</td>
							<td className='px-3 py-2.5 tabular-nums'>${log.estimatedCostUsd.toFixed(4)}</td>
							<td className='px-3 py-2.5'>
								<span className='bg-muted rounded px-1.5 py-0.5 font-mono'>
									{log.chunkingStrategy}
								</span>
							</td>
							<td className='px-3 py-2.5 text-center'>{log.rerankingUsed ? '✓' : '—'}</td>
							<td className='px-3 py-2.5 text-center'>{log.hasCitation ? '✓' : '—'}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
