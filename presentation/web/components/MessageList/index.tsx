'use client';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { MessageDto } from '@/shared/dtos/MessageDto';
import { CitationDto } from '@/shared/dtos/CitationDto';
import { CitationList } from '@/presentation/web/components/CitationList';
import { StreamingText } from '@/presentation/web/components/StreamingText';

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
		<div className='flex items-center gap-1 px-0.5 py-1'>
			<span className='dot-1 bg-terracotta-500 inline-block h-1.5 w-1.5 rounded-full' />
			<span className='dot-2 bg-terracotta-500 inline-block h-1.5 w-1.5 rounded-full' />
			<span className='dot-3 bg-terracotta-500 inline-block h-1.5 w-1.5 rounded-full' />
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
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
							>
								{isThinking ? (
									<TypingIndicator />
								) : (
									<StreamingText text={msg.content} animate={animateTokens} />
								)}
							</div>
							{!isUser && citations.length > 0 && <CitationList citations={citations} />}
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
