'use client';
import { useState, useRef, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/presentation/components/ui/button';
import { Textarea } from '@/presentation/components/ui/textarea';

interface MessageInputProps {
	onSend: (message: string) => void;
	disabled?: boolean;
	placeholder?: string;
}

export function MessageInput({
	onSend,
	disabled = false,
	placeholder = 'Ask a question…',
}: MessageInputProps) {
	const [value, setValue] = useState('');
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSend = () => {
		const trimmed = value.trim();
		if (!trimmed || disabled) return;
		onSend(trimmed);
		setValue('');
		textareaRef.current?.focus();
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className='flex items-end gap-2 border-t p-3'>
			<Textarea
				ref={textareaRef}
				value={value}
				onChange={e => setValue(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				disabled={disabled}
				rows={1}
				className='min-h-[40px] flex-1 resize-none'
			/>
			<Button
				size='icon'
				onClick={handleSend}
				disabled={disabled || !value.trim()}
				className='shrink-0'
				aria-label='Send message'
			>
				<Send className='h-4 w-4' />
			</Button>
		</div>
	);
}
