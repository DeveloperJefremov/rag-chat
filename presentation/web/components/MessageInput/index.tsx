'use client';
import clsx from 'clsx';
import { KeyboardEvent, useRef, useState } from 'react';
import { Button } from '@/presentation/components/ui/button';
import { BrandTextarea } from '@/presentation/web/components/ui/BrandTextarea';
import { MAX_CHAT_MESSAGE_CHARS } from '@/shared/config/constants';

const COUNTER_THRESHOLD = MAX_CHAT_MESSAGE_CHARS * 0.8;

interface MessageInputProps {
	onSend: (message: string) => void;
	onStop?: () => void;
	disabled?: boolean;
	placeholder?: string;
	isStreaming?: boolean;
}

export function MessageInput({
	onSend,
	onStop,
	disabled = false,
	placeholder = 'Ask anything about your knowledge base…',
	isStreaming = false,
}: MessageInputProps) {
	const [value, setValue] = useState('');
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSend = () => {
		const trimmed = value.trim();
		if (!trimmed || disabled || trimmed.length > MAX_CHAT_MESSAGE_CHARS) return;
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

	const trimmedLen = value.trim().length;
	const tooLong = trimmedLen > MAX_CHAT_MESSAGE_CHARS;
	const showCounter = value.length >= COUNTER_THRESHOLD;
	const canSend = !disabled && trimmedLen > 0 && !tooLong;

	return (
		<div className='border-powder-200 bg-paper desk:gap-3 desk:p-4 flex flex-shrink-0 items-end gap-2.5 border-t p-3'>
			<div className='relative flex-1'>
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
					maxLength={MAX_CHAT_MESSAGE_CHARS}
					aria-invalid={tooLong || undefined}
					className={clsx(
						'max-h-[120px] min-h-11 w-full overflow-y-auto px-4 py-3 text-sm',
						isStreaming ? 'bg-sand/50' : 'bg-sand',
					)}
				/>
				{showCounter && (
					<span
						aria-live='polite'
						className={clsx(
							'pointer-events-none absolute right-2 bottom-1 font-mono text-[10px] tracking-[0.05em]',
							tooLong ? 'text-terracotta-600' : 'text-smoke',
						)}
					>
						{trimmedLen}/{MAX_CHAT_MESSAGE_CHARS}
					</span>
				)}
			</div>
			{isStreaming ? (
				<Button
					type='button'
					variant='ghost'
					onClick={onStop}
					disabled={!onStop}
					aria-label='Stop generating'
					title='Stop generating'
					className='text-paper bg-terracotta-600 hover:bg-terracotta-700 desk:h-11 desk:w-auto desk:rounded-lg desk:gap-1.5 desk:px-5 desk:py-3 desk:text-[13px] flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-none p-0 font-medium transition-colors'
				>
					<svg width='14' height='14' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>
						<rect x='6' y='6' width='12' height='12' rx='1.5' />
					</svg>
					<span className='desk:inline hidden'>Stop</span>
				</Button>
			) : (
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
				</Button>
			)}
		</div>
	);
}
