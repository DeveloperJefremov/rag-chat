'use client';
import { useEffect, useState } from 'react';
import { useSessionStore } from '@/client/stores/sessionStore';
import { useChatStore } from '@/client/stores/chatStore';
import { useControlsStore } from '@/client/stores/controlsStore';
import { useAttachmentStore } from '@/client/stores/attachmentStore';
import { useUploadStore } from '@/client/stores/uploadStore';
import { useUsageStore } from '@/client/stores/usageStore';
import { MessageList } from '@/presentation/web/components/MessageList';
import { MessageInput } from '@/presentation/web/components/MessageInput';
import { LimitBadge } from '@/presentation/web/components/LimitBadge';
import { MobileMenuButton } from '@/presentation/web/components/MobileMenuButton';
import { Button } from '@/presentation/components/ui/button';
import { AttachmentChips } from './AttachmentChips';
import { AddFromLibraryDialog } from './AddFromLibraryDialog';
import { OnboardingHero } from './OnboardingHero';

export function ChatPage() {
	const { sessions, activeSessionId, fetchSessions, createSession } = useSessionStore();
	const { messages, citationsByMessageId, isStreaming, sendMessage, stopStreaming } =
		useChatStore();
	const { chunkingStrategy, topK, rerankingEnabled } = useControlsStore();
	const { documents, loaded: documentsLoaded, fetchDocuments } = useUploadStore();
	const { remaining, fetchUsage } = useUsageStore();
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
		fetchUsage();
	}, [fetchSessions, fetchDocuments, fetchUsage]);

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

					<Button
						type='button'
						variant='ghost'
						onClick={() => setLibraryOpen(true)}
						disabled={!sessionId}
						className='text-cobalt-700 hover:text-cobalt-700 h-auto cursor-pointer rounded-none border-none bg-transparent p-0 text-xs font-normal underline hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-50'
					>
						+ Add from library
					</Button>
				</div>

				<div className='flex items-center gap-3'>
					<LimitBadge remaining={remaining} />
					<div className='text-smoke font-mono text-[10px] tracking-[0.15em] uppercase'>
						{sourcesCount} sources · {activeIds.length} active
					</div>
				</div>
			</div>

			{documentsLoaded && documents.length === 0 ? (
				<OnboardingHero />
			) : attached.length === 0 ? (
				<div className='desk:p-10 flex flex-1 flex-col items-center justify-center gap-3 p-6'>
					<div className='text-cobalt-800/60 desk:text-2xl text-center font-serif text-xl italic'>
						No documents attached to this chat
					</div>
					<Button
						type='button'
						variant='ghost'
						onClick={() => setLibraryOpen(true)}
						className='h-auto cursor-pointer rounded-none border-none bg-transparent p-0 text-xs font-normal underline hover:bg-transparent'
					>
						+ Add from library
					</Button>
				</div>
			) : (
				<MessageList
					messages={messages}
					citationsByMessageId={citationsByMessageId}
					isStreaming={isStreaming}
				/>
			)}

			{!(documentsLoaded && documents.length === 0) && (
				<MessageInput
					onSend={handleSend}
					onStop={stopStreaming}
					disabled={activeIds.length === 0}
					isStreaming={isStreaming}
					placeholder={
						activeIds.length === 0
							? 'Attach or activate a document first…'
							: 'Ask anything about your knowledge base…'
					}
				/>
			)}

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
