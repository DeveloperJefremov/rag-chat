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
import { MobileMenuButton } from '@/presentation/web/components/MobileMenuButton';
import { AttachmentChips } from './AttachmentChips';
import { AddFromLibraryDialog } from './AddFromLibraryDialog';

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
		<div className='bg-paper flex h-full flex-col overflow-hidden'>
			<div className='border-powder-200 bg-paper desk:px-6 desk:py-3.5 flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3'>
				<div className='flex min-w-0 flex-wrap items-center gap-3'>
					<MobileMenuButton />
					<div className='animate-pulse-dot bg-terracotta-500 h-2 w-2 rounded-full' />
					<span className='text-cobalt-800 desk:text-[18px] font-serif text-lg font-light'>
						Knowledge Assistant
					</span>

					<AttachmentChips
						docs={attached}
						active={active}
						onToggle={id => sessionId && toggleActive(sessionId, id)}
						onDetach={id => sessionId && detach(sessionId, id)}
					/>

					<button
						type='button'
						onClick={() => setLibraryOpen(true)}
						disabled={!sessionId}
						className='text-cobalt-700 cursor-pointer text-xs underline disabled:cursor-not-allowed disabled:opacity-50'
					>
						+ Add from library
					</button>
				</div>

				<div className='flex items-center gap-3'>
					<LimitBadge remaining={null} />
					<div className='text-smoke font-mono text-[10px] tracking-[0.15em] uppercase'>
						{sourcesCount} sources · {activeIds.length} active
					</div>
				</div>
			</div>

			{attached.length === 0 ? (
				<div className='desk:p-10 flex flex-1 flex-col items-center justify-center gap-3 p-6'>
					<div className='text-cobalt-800/60 desk:text-2xl text-center font-serif text-xl italic'>
						No documents attached to this chat
					</div>
					<button
						type='button'
						onClick={() => setLibraryOpen(true)}
						className='cursor-pointer text-xs underline'
					>
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
