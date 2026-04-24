'use client';
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
		<div
			style={{
				padding: '16px 20px',
				borderTop: '1px solid var(--powder-200)',
				background: 'var(--paper)',
				display: 'flex',
				gap: 10,
				alignItems: 'flex-end',
				flexShrink: 0,
			}}
		>
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
				style={{
					flex: 1,
					padding: '12px 16px',
					background: isStreaming ? 'rgba(244,237,224,0.5)' : 'var(--sand)',
					border: '1px solid var(--powder-300)',
					borderRadius: 8,
					fontFamily: 'inherit',
					fontSize: 14,
					color: 'var(--ink)',
					resize: 'none',
					outline: 'none',
					lineHeight: 1.5,
					maxHeight: 120,
					overflowY: 'auto',
					transition: 'border-color 0.15s, background 0.15s',
				}}
				onFocus={e => (e.target.style.borderColor = 'var(--cobalt-700)')}
				onBlur={e => (e.target.style.borderColor = 'var(--powder-300)')}
			/>
			<button
				onClick={handleSend}
				disabled={!canSend}
				style={{
					padding: '12px 20px',
					background: canSend ? 'var(--cobalt-800)' : 'var(--powder-300)',
					color: 'var(--paper)',
					border: 'none',
					borderRadius: 8,
					fontFamily: 'inherit',
					fontSize: 13,
					fontWeight: 500,
					cursor: canSend ? 'pointer' : 'not-allowed',
					transition: 'background 0.15s',
					display: 'flex',
					alignItems: 'center',
					gap: 6,
					flexShrink: 0,
					height: 44,
				}}
				onMouseEnter={e => {
					if (canSend) e.currentTarget.style.background = 'var(--terracotta-600)';
				}}
				onMouseLeave={e => {
					if (canSend) e.currentTarget.style.background = 'var(--cobalt-800)';
				}}
			>
				{isStreaming ? (
					<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
						<span
							className='dot-1'
							style={{
								width: 5,
								height: 5,
								borderRadius: '50%',
								background: 'var(--paper)',
								display: 'inline-block',
							}}
						/>
						<span
							className='dot-2'
							style={{
								width: 5,
								height: 5,
								borderRadius: '50%',
								background: 'var(--paper)',
								display: 'inline-block',
							}}
						/>
						<span
							className='dot-3'
							style={{
								width: 5,
								height: 5,
								borderRadius: '50%',
								background: 'var(--paper)',
								display: 'inline-block',
							}}
						/>
					</span>
				) : (
					'Send →'
				)}
			</button>
		</div>
	);
}
