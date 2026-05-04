'use client';
import * as React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface ToggleChipProps extends Omit<React.ComponentProps<typeof Button>, 'variant'> {
	active?: boolean;
}

export function ToggleChip({
	active = false,
	className,
	type = 'button',
	...props
}: ToggleChipProps) {
	return (
		<Button
			variant='ghost'
			type={type}
			aria-pressed={active}
			className={cn(
				'h-auto cursor-pointer rounded-md border px-3.5 py-1.5 text-xs font-normal transition-colors',
				active
					? 'border-cobalt-800 bg-cobalt-800 text-paper hover:bg-cobalt-800 hover:text-paper'
					: 'border-powder-300 bg-paper text-cobalt-800 hover:border-cobalt-700 hover:bg-paper',
				className,
			)}
			{...props}
		/>
	);
}
