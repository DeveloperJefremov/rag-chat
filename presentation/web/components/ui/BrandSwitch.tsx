'use client';
import * as React from 'react';
import { Switch } from '@/presentation/components/ui/switch';
import { cn } from '@/shared/lib/utils';

export function BrandSwitch({ className, ...props }: React.ComponentProps<typeof Switch>) {
	return (
		<Switch
			className={cn(
				'data-[state=checked]:bg-cobalt-800 data-[state=unchecked]:bg-powder-300 cursor-pointer',
				className,
			)}
			{...props}
		/>
	);
}
