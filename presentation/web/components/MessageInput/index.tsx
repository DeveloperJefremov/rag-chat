'use client';
import clsx from 'clsx';
import { KeyboardEvent, useRef, useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { BrandTextarea } from '@/presentation/web/components/ui/BrandTextarea';

interface MessageInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
	placeholder?: string;
	isStreaming?: boolean;
}

export function MessageInput({
	onSend,
	disabled = false,
	placeholder = 'Ask anything about your knowledge base…',
	isStreaming = false,
}: MessageInputProps) {
	const [value, setValue] = useState('');
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSend = () => {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setValue('');
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
			textareaRef.current.focus();
		}
	};

	const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const canSend = !disabled && value.trim().length > 0;

	return (
		<div className='border-powder-200 bg-paper desk:gap-3 desk:p-4 flex flex-shrink-0 items-end gap-2.5 border-t p-3'>
			<BrandTextarea
				ref={textareaRef}
				value={value}
				onChange={e => {
					setValue(e.target.value);
					e.target.style.height = 'auto';
					e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
				}}
				onKeyDown={handleKey}
				disabled={isStreaming}
				placeholder={placeholder}
				rows={1}
				className={clsx(
					'max-h-[120px] min-h-11 flex-1 overflow-y-auto px-4 py-3 text-sm',
					isStreaming ? 'bg-sand/50' : 'bg-sand',
				)}
			/>
			<Button
				type='button'
				variant='ghost'
				onClick={handleSend}
				disabled={!canSend}
				aria-label='Send message'
				className={clsx(
					'text-paper desk:h-11 desk:w-auto desk:rounded-lg desk:gap-1.5 desk:px-5 desk:py-3 desk:text-[13px] flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-none p-0 font-medium transition-colors',
					canSend
						? 'bg-cobalt-800 hover:bg-terracotta-600 hover:text-paper cursor-pointer'
						: 'bg-powder-300 cursor-not-allowed',
				)}
			>
				{isStreaming ? (
					<span className='flex items-center gap-1'>
						<span className='dot-1 bg-paper inline-block h-[5px] w-[5px] rounded-full' />
						<span className='dot-2 bg-paper inline-block h-[5px] w-[5px] rounded-full' />
						<span className='dot-3 bg-paper inline-block h-[5px] w-[5px] rounded-full' />
					</span>
				) : (
					<>
						<svg
							width='18'
							height='18'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2.25'
							strokeLinecap='round'
							strokeLinejoin='round'
							className='desk:hidden'
							aria-hidden='true'
						>
							<line x1='12' y1='19' x2='12' y2='5' />
							<polyline points='5 12 12 5 19 12' />
						</svg>
						<span className='desk:inline hidden'>Send →</span>
					</>
				)}
			</Button>
		</div>
	);
}
