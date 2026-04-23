import { Badge } from '@/presentation/components/ui/badge';

interface LimitBadgeProps {
	remaining: number | null;
}

export function LimitBadge({ remaining }: LimitBadgeProps) {
	if (remaining === null) return null;

	const isLow = remaining <= 10;
	const isExhausted = remaining === 0;

	return (
		<Badge
			variant={isExhausted ? 'destructive' : isLow ? 'outline' : 'secondary'}
			className='text-xs'
		>
			{isExhausted ? 'Limit reached' : `${remaining} queries left today`}
		</Badge>
	);
}
