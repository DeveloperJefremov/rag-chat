'use client';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { MessageDto } from '@/shared/dtos/MessageDto';
import { CitationDto } from '@/shared/dtos/CitationDto';
import { CitationList } from '@/presentation/web/components/CitationList';
import { StreamingText } from '@/presentation/web/components/StreamingText';

const GK_SENTINEL = '[GENERAL_KNOWLEDGE]';

function extractGeneralKnowledge(content: string): { marker: boolean; body: string } {
	const trimmedStart = content.replace(/^\s+/, '');
	if (trimmedStart.startsWith(GK_SENTINEL)) {
		const after = trimmedStart.slice(GK_SENTINEL.length).replace(/^\n/, '');
		return { marker: true, body: after };
	}
	if (GK_SENTINEL.startsWith(trimmedStart) && trimmedStart.length > 0) {
		return { marker: true, body: '' };
	}
	return { marker: false, body: content };
}

function GeneralKnowledgeBadge() {
	return (
		<div className='border-terracotta-500/30 bg-terracotta-500/[0.08] mb-2.5 flex items-center gap-2 rounded-md border px-2.5 py-1.5'>
			<svg
				width='12'
				height='12'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='2'
				className='text-terracotta-600 flex-shrink-0'
				aria-hidden='true'
			>
				<circle cx='12' cy='12' r='10' />
				<line x1='12' y1='8' x2='12' y2='12' />
				<line x1='12' y1='16' x2='12.01' y2='16' />
			</svg>
			<span className='text-terracotta-700 font-mono text-[9px] leading-none tracking-[0.15em] uppercase'>
				General knowledge · not from your documents
			</span>
		</div>
	);
}

interface MessageListProps {
	messages: MessageDto[];
	citationsByMessageId: Record<string, CitationDto[]>;
	isStreaming: boolean;
}

function Avatar({ role }: { role: 'USER' | 'ASSISTANT' }) {
	const isUser = role === 'USER';
	return (
		<div
			className={clsx(
				'text-paper flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-medium tracking-[0.05em]',
				isUser ? 'bg-cobalt-800' : 'bg-terracotta-600',
			)}
		>
			{isUser ? 'You' : 'AI'}
		</div>
	);
}

function TypingIndicator() {
	return (
		<div
			className='flex items-center gap-1 px-0.5 py-1'
			role='status'
			aria-label='Assistant is typing'
		>
			<span
				className='dot-1 bg-terracotta-500 inline-block h-1.5 w-1.5 rounded-full'
				aria-hidden='true'
			/>
			<span
				className='dot-2 bg-terracotta-500 inline-block h-1.5 w-1.5 rounded-full'
				aria-hidden='true'
			/>
			<span
				className='dot-3 bg-terracotta-500 inline-block h-1.5 w-1.5 rounded-full'
				aria-hidden='true'
			/>
		</div>
	);
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString('en', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
}

export function MessageList({ messages, citationsByMessageId, isStreaming }: MessageListProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const prefersReducedMotion =
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
		bottomRef.current?.scrollIntoView({
			behavior: prefersReducedMotion ? 'auto' : 'smooth',
		});
	}, [messages]);

	if (messages.length === 0 && !isStreaming) {
		return (
			<div className='text-powder-400 desk:p-10 flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center'>
				<div className='text-cobalt-800/50 desk:text-2xl font-serif text-xl italic'>
					Start a new conversation
				</div>
				<div className='text-smoke font-mono text-[10px] tracking-[0.12em] uppercase'>
					Ask anything about your knowledge base
				</div>
			</div>
		);
	}

	const showTypingBubble =
		isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === 'USER';

	return (
		<div className='desk:px-6 desk:py-6 desk:gap-[22px] flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4'>
			{messages.map((msg, idx) => {
				const isUser = msg.role === 'USER';
				const citations = citationsByMessageId[msg.id] ?? [];
				const isLast = idx === messages.length - 1;
				const isStreamingThis = isStreaming && !isUser && isLast;
				const isThinking = isStreamingThis && msg.content === '';
				const animateTokens = isStreamingThis && !isThinking;
				const extracted = !isUser
					? extractGeneralKnowledge(msg.content)
					: { marker: false, body: msg.content };
				return (
					<div
						key={msg.id}
						className={clsx(
							'msg-animated desk:max-w-[720px] flex max-w-[88%] gap-3',
							isUser ? 'flex-row-reverse self-end' : 'flex-row self-start',
						)}
					>
						<Avatar role={msg.role} />
						<div className={clsx('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
							<div
								className={clsx(
									'px-4 py-3 text-sm leading-[1.58] whitespace-pre-wrap',
									isUser
										? 'bg-cobalt-800 text-paper rounded-[12px_12px_2px_12px]'
										: 'bg-powder-100 text-ink rounded-[12px_12px_12px_2px]',
									isThinking && 'thinking-bubble',
								)}
								{...(isStreamingThis
									? { role: 'status', 'aria-live': 'polite', 'aria-atomic': false }
									: {})}
							>
								{isThinking ? (
									<TypingIndicator />
								) : (
									<>
										{extracted.marker && <GeneralKnowledgeBadge />}
										<StreamingText
											text={extracted.body}
											animate={animateTokens}
											citations={citations}
										/>
									</>
								)}
							</div>
							{!isUser && !extracted.marker && citations.length > 0 && (
								<CitationList citations={citations} />
							)}
							<div className='text-smoke mt-0.5 font-mono text-[10px] tracking-[0.1em] uppercase'>
								{formatTime(msg.createdAt)}
							</div>
						</div>
					</div>
				);
			})}

			{showTypingBubble && (
				<div className='msg-animated desk:max-w-[720px] flex max-w-[88%] gap-3 self-start'>
					<Avatar role='ASSISTANT' />
					<div className='bg-powder-100 rounded-[12px_12px_12px_2px] px-4 py-3'>
						<TypingIndicator />
					</div>
				</div>
			)}

			<div ref={bottomRef} />
		</div>
	);
}
