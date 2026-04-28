import clsx from 'clsx';

interface LimitBadgeProps {
	remaining: number | null;
}

export function LimitBadge({ remaining }: LimitBadgeProps) {
	if (remaining === null) return null;

	const isExhausted = remaining === 0;
	const isLow = remaining <= 10;

	return (
		<span
			className={clsx(
				'rounded-[4px] border px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] uppercase opacity-90',
				isExhausted
					? 'border-terracotta-600 text-terracotta-600'
					: isLow
						? 'border-terracotta-500 text-terracotta-500'
						: 'border-smoke text-smoke',
			)}
		>
			{isExhausted ? 'Limit reached' : `${remaining} left`}
		</span>
	);
}
