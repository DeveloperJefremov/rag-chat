'use client';
import { useEffect, useState } from 'react';
import { useSessionStore } from '@/client/stores/sessionStore';
import { useChatStore } from '@/client/stores/chatStore';
import { useControlsStore } from '@/client/stores/controlsStore';
import { MessageList } from '@/presentation/web/components/MessageList';
import { MessageInput } from '@/presentation/web/components/MessageInput';
import { LimitBadge } from '@/presentation/web/components/LimitBadge';
import { KnowledgePanel } from './KnowledgePanel';
import { AdvancedControls } from './AdvancedControls';

export function ChatPage() {
	const { sessions, activeSessionId, fetchSessions, createSession } = useSessionStore();
	const { messages, citationsByMessageId, isStreaming, sendMessage } = useChatStore();
	const { chunkingStrategy, topK, rerankingEnabled } = useControlsStore();
	const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

	// Bootstrap: fetch or create a session on mount
	useEffect(() => {
		fetchSessions().then(async () => {
			// Sessions will be updated in store; if none exist, create one
		});
	}, [fetchSessions]);

	const sessionId = activeSessionId ?? sessions[0]?.id;

	const handleSend = async (message: string) => {
		if (!activeDocumentId) return;

		// Create a session if we don't have one
		let sid = sessionId;
		if (!sid) {
			const newSession = await createSession();
			sid = newSession.id;
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

	const isLimitReached = false; // TODO: wire up UserUsage remaining from session store

	return (
		<div className='flex h-full'>
			<KnowledgePanel activeDocumentId={activeDocumentId} onSelectDocument={setActiveDocumentId} />

			<div className='flex flex-1 flex-col overflow-hidden'>
				{/* Top bar */}
				<div className='flex shrink-0 items-center justify-between border-b px-4 py-2'>
					<span className='text-muted-foreground text-sm font-medium'>
						{activeDocumentId
							? 'Ask about your document'
							: 'Select a document from the Knowledge panel'}
					</span>
					<LimitBadge remaining={null} />
				</div>

				{/* Messages */}
				<MessageList
					messages={messages}
					citationsByMessageId={citationsByMessageId}
					isStreaming={isStreaming}
				/>

				{/* Advanced controls + input */}
				<div className='shrink-0'>
					<AdvancedControls />
					<MessageInput
						onSend={handleSend}
						disabled={!activeDocumentId || isLimitReached || isStreaming}
						placeholder={!activeDocumentId ? 'Select a document first…' : 'Ask a question…'}
					/>
				</div>
			</div>
		</div>
	);
}
