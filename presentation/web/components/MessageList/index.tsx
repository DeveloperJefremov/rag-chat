'use client';
import { useEffect, useRef } from 'react';
import { MessageDto } from '@/shared/dtos/MessageDto';
import { CitationDto } from '@/shared/dtos/CitationDto';
import { CitationList } from '@/presentation/web/components/CitationList';
import { Skeleton } from '@/presentation/components/ui/skeleton';

interface MessageListProps {
	messages: MessageDto[];
	citationsByMessageId: Record<string, CitationDto[]>;
	isStreaming: boolean;
}

export function MessageList({ messages, citationsByMessageId, isStreaming }: MessageListProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	if (messages.length === 0) {
		return (
			<div className='flex flex-1 items-center justify-center'>
				<p className='text-muted-foreground text-sm'>
					Select a document and ask a question to get started.
				</p>
			</div>
		);
	}

	return (
		<div className='flex-1 space-y-4 overflow-auto p-4'>
			{messages.map(msg => {
				const isUser = msg.role === 'USER';
				const citations = citationsByMessageId[msg.id] ?? [];

				return (
					<div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
						<div
							className={`max-w-[75%] space-y-2 rounded-lg px-4 py-2.5 text-sm ${
								isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
							}`}
						>
							<p className='leading-relaxed whitespace-pre-wrap'>{msg.content}</p>
							{!isUser && citations.length > 0 && <CitationList citations={citations} />}
						</div>
					</div>
				);
			})}

			{isStreaming && messages[messages.length - 1]?.role === 'USER' && (
				<div className='flex justify-start'>
					<div className='bg-muted max-w-[75%] space-y-1.5 rounded-lg px-4 py-3'>
						<Skeleton className='h-3 w-48' />
						<Skeleton className='h-3 w-36' />
					</div>
				</div>
			)}

			<div ref={bottomRef} />
		</div>
	);
}
