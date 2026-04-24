import { LLMOpsLogEntry } from '@/client/application/api/ILLMOpsApi';

interface QueryLogTableProps {
	logs: LLMOpsLogEntry[];
	showCost: boolean;
}

function CitationDots({ count }: { count: number }) {
	return (
		<div style={{ display: 'flex', gap: 3 }}>
			{Array.from({ length: Math.min(count, 5) }).map((_, j) => (
				<div
					key={j}
					style={{
						width: 6,
						height: 6,
						borderRadius: 1,
						background: 'var(--terracotta-500)',
						opacity: 0.7 + j * 0.06,
					}}
				/>
			))}
		</div>
	);
}

export function QueryLogTable({ logs, showCost }: QueryLogTableProps) {
	if (logs.length === 0) {
		return (
			<div
				style={{
					background: 'var(--paper)',
					border: '1px solid var(--powder-200)',
					borderRadius: 10,
					padding: '40px 20px',
					textAlign: 'center',
				}}
			>
				<p
					style={{
						fontFamily: 'var(--font-jetbrains-mono), monospace',
						fontSize: 12,
						color: 'var(--smoke)',
					}}
				>
					No queries yet.
				</p>
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
		<div
			style={{
				background: 'var(--paper)',
				border: '1px solid var(--powder-200)',
				borderRadius: 10,
				overflow: 'hidden',
				animation: 'fade-up 0.4s ease 0.3s both',
			}}
		>
			{/* Table header row */}
			<div
				style={{
					padding: '14px 20px',
					borderBottom: '1px solid var(--powder-200)',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
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
					Recent Queries
				</div>
				<div
					style={{
						fontFamily: 'var(--font-jetbrains-mono), monospace',
						fontSize: 10,
						color: 'var(--terracotta-600)',
					}}
				>
					{today}
				</div>
			</div>

			{/* Column headers */}
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: cols,
					padding: '8px 20px',
					background: 'var(--sand)',
					borderBottom: '1px solid var(--powder-200)',
				}}
			>
				{headers.map(h => (
					<div
						key={h}
						style={{
							fontFamily: 'var(--font-jetbrains-mono), monospace',
							fontSize: 9,
							letterSpacing: '0.12em',
							textTransform: 'uppercase',
							color: 'var(--smoke)',
						}}
					>
						{h}
					</div>
				))}
			</div>

			{/* Rows */}
			{logs.map((log, i) => {
				const latencyColor =
					log.latencyMs < 600
						? '#2d8a4e'
						: log.latencyMs < 800
							? 'var(--cobalt-700)'
							: 'var(--terracotta-600)';

				const citationCount = log.hasCitation ? Math.max(1, Math.round(log.promptTokens / 800)) : 0;

				return (
					<div
						key={log.id}
						style={{
							display: 'grid',
							gridTemplateColumns: cols,
							padding: '11px 20px',
							borderBottom: i < logs.length - 1 ? '1px solid var(--powder-200)' : 'none',
							alignItems: 'center',
						}}
					>
						<div
							style={{
								fontFamily: 'inherit',
								fontSize: 13,
								color: 'var(--ink)',
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
								paddingRight: 12,
							}}
							title={log.query}
						>
							{log.query}
						</div>
						<div
							style={{
								fontFamily: 'var(--font-jetbrains-mono), monospace',
								fontSize: 12,
								color: latencyColor,
								fontWeight: 500,
							}}
						>
							{log.latencyMs}ms
						</div>
						<div
							style={{
								fontFamily: 'var(--font-jetbrains-mono), monospace',
								fontSize: 11,
								color: 'var(--smoke)',
							}}
						>
							gemini-2.5-flash
						</div>
						<CitationDots count={citationCount} />
						{showCost && (
							<div
								style={{
									fontFamily: 'var(--font-jetbrains-mono), monospace',
									fontSize: 11,
									color: 'var(--smoke)',
								}}
							>
								${log.estimatedCostUsd.toFixed(4)}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
