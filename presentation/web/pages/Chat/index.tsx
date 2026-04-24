'use client';
import { useEffect, useState } from 'react';
import { useSessionStore } from '@/client/stores/sessionStore';
import { useChatStore } from '@/client/stores/chatStore';
import { useControlsStore } from '@/client/stores/controlsStore';
import { useUploadStore } from '@/client/stores/uploadStore';
import { MessageList } from '@/presentation/web/components/MessageList';
import { MessageInput } from '@/presentation/web/components/MessageInput';
import { LimitBadge } from '@/presentation/web/components/LimitBadge';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };

export function ChatPage() {
	const { sessions, activeSessionId, fetchSessions, createSession } = useSessionStore();
	const { messages, citationsByMessageId, isStreaming, sendMessage } = useChatStore();
	const { chunkingStrategy, topK, rerankingEnabled } = useControlsStore();
	const { documents } = useUploadStore();
	const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

	useEffect(() => {
		fetchSessions();
	}, [fetchSessions]);

	const activeDocumentId = selectedDocumentId ?? documents[0]?.documentId ?? null;
	const sessionId = activeSessionId ?? sessions[0]?.id;
	const activeDoc = documents.find(d => d.documentId === activeDocumentId);

	const handleSend = async (message: string) => {
		if (!activeDocumentId) return;
		let sid = sessionId;
		if (!sid) {
			const ns = await createSession();
			sid = ns.id;
		}
		await sendMessage({
			message,
			sessionId: sid,
			documentId: activeDocumentId,
			chunkingStrategy,
			topK,
			rerankingEnabled,
		});
	};

	const sourcesCount = Object.values(citationsByMessageId).reduce((s, c) => s + c.length, 0);

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				background: 'var(--paper)',
				overflow: 'hidden',
			}}
		>
			{/* Header */}
			<div
				style={{
					padding: '18px 24px',
					borderBottom: '1px solid var(--powder-200)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					background: 'var(--paper)',
					flexShrink: 0,
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					<div
						style={{
							width: 8,
							height: 8,
							borderRadius: '50%',
							background: 'var(--terracotta-500)',
							animation: 'pulse-dot 2.5s ease-in-out infinite',
						}}
					/>
					<span
						style={{
							fontFamily: 'var(--font-fraunces), serif',
							fontSize: 18,
							fontWeight: 300,
							color: 'var(--cobalt-800)',
						}}
					>
						Knowledge Assistant
					</span>

					{documents.length > 0 && (
						<select
							value={activeDocumentId ?? ''}
							onChange={e => setSelectedDocumentId(e.target.value || null)}
							style={{
								...MONO,
								fontSize: 11,
								padding: '5px 10px',
								background: 'var(--sand)',
								border: '1px solid var(--powder-300)',
								borderRadius: 6,
								color: 'var(--cobalt-700)',
								cursor: 'pointer',
								outline: 'none',
								marginLeft: 8,
							}}
						>
							{documents.map(d => (
								<option key={d.documentId} value={d.documentId}>
									{d.name}
								</option>
							))}
						</select>
					)}
				</div>

				<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
					<LimitBadge remaining={null} />
					<div
						style={{
							...MONO,
							fontSize: 10,
							letterSpacing: '0.15em',
							textTransform: 'uppercase',
							color: 'var(--smoke)',
						}}
					>
						{sourcesCount} sources · {activeDoc ? 'indexed' : 'no document'}
					</div>
				</div>
			</div>

			{/* Empty state when no documents */}
			{documents.length === 0 ? (
				<div
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
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
							opacity: 0.6,
						}}
					>
						No documents indexed yet
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
						Upload a document from the Documents page to begin
					</div>
				</div>
			) : (
				<MessageList
					messages={messages}
					citationsByMessageId={citationsByMessageId}
					isStreaming={isStreaming}
				/>
			)}

			<MessageInput
				onSend={handleSend}
				disabled={!activeDocumentId}
				isStreaming={isStreaming}
				placeholder={
					!activeDocumentId ? 'Select a document first…' : 'Ask anything about your knowledge base…'
				}
			/>
		</div>
	);
}
