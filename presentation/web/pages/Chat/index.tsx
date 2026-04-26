'use client';
import { useEffect, useState } from 'react';
import { useSessionStore } from '@/client/stores/sessionStore';
import { useChatStore } from '@/client/stores/chatStore';
import { useControlsStore } from '@/client/stores/controlsStore';
import { useAttachmentStore } from '@/client/stores/attachmentStore';
import { useUploadStore } from '@/client/stores/uploadStore';
import { MessageList } from '@/presentation/web/components/MessageList';
import { MessageInput } from '@/presentation/web/components/MessageInput';
import { LimitBadge } from '@/presentation/web/components/LimitBadge';
import { AttachmentChips } from './AttachmentChips';
import { AddFromLibraryDialog } from './AddFromLibraryDialog';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-jetbrains-mono), monospace' };

export function ChatPage() {
	const { sessions, activeSessionId, fetchSessions, createSession } = useSessionStore();
	const { messages, citationsByMessageId, isStreaming, sendMessage } = useChatStore();
	const { chunkingStrategy, topK, rerankingEnabled } = useControlsStore();
	const { fetchDocuments } = useUploadStore();
	const { attachedBySession, activeBySession, loadAttached, toggleActive, detach } =
		useAttachmentStore();
	const [libraryOpen, setLibraryOpen] = useState(false);

	const sessionId = activeSessionId ?? sessions[0]?.id ?? null;
	const attached = sessionId ? (attachedBySession[sessionId] ?? []) : [];
	const active = sessionId ? (activeBySession[sessionId] ?? new Set<string>()) : new Set<string>();
	const activeIds = Array.from(active);

	useEffect(() => {
		fetchSessions();
		fetchDocuments();
	}, [fetchSessions, fetchDocuments]);

	useEffect(() => {
		if (sessionId) void loadAttached(sessionId);
	}, [sessionId, loadAttached]);

	const handleSend = async (message: string) => {
		if (activeIds.length === 0) return;
		let sid = sessionId;
		if (!sid) {
			const ns = await createSession();
			sid = ns.id;
		}
		await sendMessage({
			message,
			sessionId: sid,
			documentIds: activeIds,
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
			<div
				style={{
					padding: '14px 24px',
					borderBottom: '1px solid var(--powder-200)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					background: 'var(--paper)',
					flexShrink: 0,
					gap: 12,
				}}
			>
				<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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

					<AttachmentChips
						docs={attached}
						active={active}
						onToggle={id => sessionId && toggleActive(sessionId, id)}
						onDetach={id => sessionId && detach(sessionId, id)}
					/>

					<button
						onClick={() => setLibraryOpen(true)}
						disabled={!sessionId}
						className='cursor-pointer text-xs underline'
						style={{ color: 'var(--cobalt-700)' }}
					>
						+ Add from library
					</button>
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
						{sourcesCount} sources · {activeIds.length} active
					</div>
				</div>
			</div>

			{attached.length === 0 ? (
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
						No documents attached to this chat
					</div>
					<button onClick={() => setLibraryOpen(true)} className='cursor-pointer text-xs underline'>
						+ Add from library
					</button>
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
				disabled={activeIds.length === 0}
				isStreaming={isStreaming}
				placeholder={
					activeIds.length === 0
						? 'Attach or activate a document first…'
						: 'Ask anything about your knowledge base…'
				}
			/>

			{sessionId && (
				<AddFromLibraryDialog
					sessionId={sessionId}
					open={libraryOpen}
					onClose={() => setLibraryOpen(false)}
				/>
			)}
		</div>
	);
}
