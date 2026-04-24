'use client';
import { useEffect, useRef } from 'react';
import { MessageDto } from '@/shared/dtos/MessageDto';
import { CitationDto } from '@/shared/dtos/CitationDto';
import { CitationList } from '@/presentation/web/components/CitationList';

interface MessageListProps {
	messages: MessageDto[];
	citationsByMessageId: Record<string, CitationDto[]>;
	isStreaming: boolean;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };

function Avatar({ role }: { role: 'USER' | 'ASSISTANT' }) {
	const isUser = role === 'USER';
	return (
		<div
			style={{
				width: 32,
				height: 32,
				borderRadius: 6,
				flexShrink: 0,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				...MONO,
				fontSize: 10,
				fontWeight: 500,
				background: isUser ? 'var(--cobalt-800)' : 'var(--terracotta-600)',
				color: 'var(--paper)',
				letterSpacing: '0.05em',
			}}
		>
			{isUser ? 'You' : 'AI'}
		</div>
	);
}

function TypingIndicator() {
	const dot: React.CSSProperties = {
		width: 6,
		height: 6,
		borderRadius: '50%',
		background: 'var(--terracotta-500)',
		display: 'inline-block',
	};
	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 2px' }}>
			<span className='dot-1' style={dot} />
			<span className='dot-2' style={dot} />
			<span className='dot-3' style={dot} />
		</div>
	);
}

function renderText(text: string) {
	const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
	return parts.map((p, i) => {
		if (p.startsWith('**') && p.endsWith('**')) {
			return <strong key={i}>{p.slice(2, -2)}</strong>;
		}
		if (p.startsWith('`') && p.endsWith('`')) {
			return (
				<code
					key={i}
					style={{
						...MONO,
						fontSize: '0.88em',
						background: 'rgba(26,46,92,0.08)',
						padding: '1px 5px',
						borderRadius: 3,
						color: 'var(--cobalt-700)',
					}}
				>
					{p.slice(1, -1)}
				</code>
			);
		}
		return <span key={i}>{p}</span>;
	});
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
			<div
				style={{
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					color: 'var(--powder-400)',
					textAlign: 'center',
					gap: 12,
					padding: 40,
				}}
			>
				<div
					style={{
						fontFamily: 'var(--font-fraunces), serif',
						fontStyle: 'italic',
						fontSize: 24,
						color: 'var(--cobalt-800)',
						opacity: 0.5,
					}}
				>
					Start a new conversation
				</div>
				<div
					style={{
						...MONO,
						fontSize: 10,
						letterSpacing: '0.12em',
						textTransform: 'uppercase',
						color: 'var(--smoke)',
					}}
				>
					Ask anything about your knowledge base
				</div>
			</div>
		);
	}

	const showTypingBubble =
		isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === 'USER';

	return (
		<div
			style={{
				flex: 1,
				overflowY: 'auto',
				padding: '28px 24px',
				display: 'flex',
				flexDirection: 'column',
				gap: 22,
			}}
		>
			{messages.map(msg => {
				const isUser = msg.role === 'USER';
				const citations = citationsByMessageId[msg.id] ?? [];
				return (
					<div
						key={msg.id}
						className='msg-animated'
						style={{
							display: 'flex',
							gap: 12,
							maxWidth: '82%',
							alignSelf: isUser ? 'flex-end' : 'flex-start',
							flexDirection: isUser ? 'row-reverse' : 'row',
						}}
					>
						<Avatar role={msg.role} />
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								gap: 4,
								alignItems: isUser ? 'flex-end' : 'flex-start',
							}}
						>
							<div
								style={{
									padding: '12px 16px',
									background: isUser ? 'var(--cobalt-800)' : 'var(--powder-100)',
									color: isUser ? 'var(--paper)' : 'var(--ink)',
									borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
									fontSize: 14,
									lineHeight: 1.58,
									whiteSpace: 'pre-wrap',
								}}
							>
								{renderText(msg.content)}
							</div>
							{!isUser && citations.length > 0 && <CitationList citations={citations} />}
							<div
								style={{
									...MONO,
									fontSize: 10,
									letterSpacing: '0.1em',
									color: 'var(--smoke)',
									textTransform: 'uppercase',
									marginTop: 2,
								}}
							>
								{formatTime(msg.createdAt)}
							</div>
						</div>
					</div>
				);
			})}

			{showTypingBubble && (
				<div
					className='msg-animated'
					style={{ display: 'flex', gap: 12, maxWidth: '82%', alignSelf: 'flex-start' }}
				>
					<Avatar role='ASSISTANT' />
					<div
						style={{
							padding: '12px 16px',
							background: 'var(--powder-100)',
							borderRadius: '12px 12px 12px 2px',
						}}
					>
						<TypingIndicator />
					</div>
				</div>
			)}

			<div ref={bottomRef} />
		</div>
	);
}
