'use client';
import * as React from 'react';
import { Button } from '@/presentation/components/ui/button';
import { cn } from '@/shared/lib/utils';

type IconButtonTone = 'default' | 'danger' | 'sidebar';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends Omit<React.ComponentProps<typeof Button>, 'variant' | 'size'> {
	tone?: IconButtonTone;
	size?: IconButtonSize;
}

const SIZE_CLASSES: Record<IconButtonSize, string> = {
	sm: 'h-7 w-7',
	md: 'h-8 w-8',
	lg: 'h-9 w-9',
};

const TONE_CLASSES: Record<IconButtonTone, string> = {
	default: 'text-cobalt-800 hover:bg-powder-200',
	danger: 'text-powder-600 hover:bg-terracotta-500/10 hover:text-terracotta-600',
	sidebar: 'text-powder-400 hover:bg-cobalt-800 hover:text-paper',
};

export function IconButton({
	tone = 'default',
	size = 'md',
	className,
	type = 'button',
	...props
}: IconButtonProps) {
	return (
		<Button
			variant='ghost'
			type={type}
			className={cn(
				'flex flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-none p-0',
				SIZE_CLASSES[size],
				TONE_CLASSES[tone],
				className,
			)}
			{...props}
		/>
	);
}
