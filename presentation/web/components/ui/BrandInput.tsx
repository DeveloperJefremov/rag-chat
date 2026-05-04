'use client';
import * as React from 'react';
import { Input } from '@/presentation/components/ui/input';
import { cn } from '@/shared/lib/utils';

export function BrandInput({ className, ...props }: React.ComponentProps<typeof Input>) {
	return (
		<Input
			className={cn(
				'bg-paper border-powder-300 text-cobalt-800 focus-visible:border-cobalt-700 focus-visible:ring-cobalt-700/20 placeholder:text-powder-500 h-9 text-sm',
				className,
			)}
			{...props}
		/>
	);
}
