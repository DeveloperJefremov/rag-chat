'use client';
import * as React from 'react';
import { Textarea } from '@/presentation/components/ui/textarea';
import { cn } from '@/shared/lib/utils';

export function BrandTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
	return (
		<Textarea
			className={cn(
				'bg-paper border-powder-300 text-ink focus-visible:border-cobalt-700 focus-visible:ring-cobalt-700/20 placeholder:text-powder-500 resize-none text-[13px] leading-[1.5]',
				className,
			)}
			{...props}
		/>
	);
}
