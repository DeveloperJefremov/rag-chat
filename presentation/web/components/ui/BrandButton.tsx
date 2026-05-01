'use client';
import * as React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { cn } from '@/shared/lib/utils';

type BrandButtonVariant = 'primary' | 'danger' | 'outline';

interface BrandButtonProps extends Omit<React.ComponentProps<typeof Button>, 'variant'> {
	tone?: BrandButtonVariant;
}

const TONE_CLASSES: Record<BrandButtonVariant, string> = {
	primary: 'border-cobalt-700 bg-cobalt-700 text-paper hover:bg-cobalt-800 hover:border-cobalt-800',
	danger:
		'border-terracotta-500 bg-terracotta-500 text-paper hover:bg-terracotta-600 hover:border-terracotta-600',
	outline: 'border-powder-300 bg-transparent text-cobalt-700 hover:bg-sand hover:border-cobalt-700',
};

export function BrandButton({
	tone = 'primary',
	className,
	type = 'button',
	...props
}: BrandButtonProps) {
	return (
		<Button
			variant='ghost'
			type={type}
			className={cn(
				'h-auto cursor-pointer rounded-md border px-[18px] py-2 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors',
				TONE_CLASSES[tone],
				'disabled:bg-powder-200 disabled:border-powder-300 disabled:text-smoke disabled:cursor-not-allowed',
				className,
			)}
			{...props}
		/>
	);
}
