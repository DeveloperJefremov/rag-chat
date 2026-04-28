'use client';
import clsx from 'clsx';
import { KeyboardEvent, useRef, useState } from 'react';

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
			<textarea
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
					'border-powder-300 text-ink focus:border-cobalt-700 max-h-[120px] flex-1 resize-none overflow-y-auto rounded-lg border px-4 py-3 text-sm leading-[1.5] transition-[border-color,background] outline-none',
					isStreaming ? 'bg-sand/50' : 'bg-sand',
				)}
			/>
			<button
				type='button'
				onClick={handleSend}
				disabled={!canSend}
				className={clsx(
					'text-paper flex h-11 flex-shrink-0 items-center gap-1.5 rounded-lg border-none px-5 py-3 text-[13px] font-medium transition-colors',
					canSend
						? 'bg-cobalt-800 hover:bg-terracotta-600 cursor-pointer'
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
					'Send →'
				)}
			</button>
		</div>
	);
}
