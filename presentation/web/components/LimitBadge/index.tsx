interface LimitBadgeProps {
	remaining: number | null;
}

export function LimitBadge({ remaining }: LimitBadgeProps) {
	if (remaining === null) return null;

	const isExhausted = remaining === 0;
	const isLow = remaining <= 10;

	const color = isExhausted
		? 'var(--terracotta-600)'
		: isLow
			? 'var(--terracotta-500)'
			: 'var(--smoke)';

	return (
		<span
			style={{
				fontFamily: 'var(--font-jetbrains-mono), monospace',
				fontSize: 10,
				letterSpacing: '0.1em',
				textTransform: 'uppercase',
				color,
				padding: '3px 8px',
				border: `1px solid ${color}`,
				borderRadius: 4,
				opacity: 0.9,
			}}
		>
			{isExhausted ? 'Limit reached' : `${remaining} left`}
		</span>
	);
}
