import { IChatApi, StreamChatParams, ChatStreamEvent } from '../../application/api/IChatApi';
import { MessageDto } from '../../../shared/dtos/MessageDto';
import { apiFetch, UnauthenticatedError } from './apiFetch';

function isAbortError(e: unknown): boolean {
	return e instanceof DOMException && e.name === 'AbortError';
}

export class ChatApi implements IChatApi {
	async *streamChat(
		params: StreamChatParams,
		signal?: AbortSignal,
	): AsyncGenerator<ChatStreamEvent> {
		let res: Response;
		try {
			res = await apiFetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(params),
				signal,
			});
		} catch (e) {
			if (signal?.aborted || isAbortError(e)) {
				yield { type: 'done' };
				return;
			}
			if (e instanceof UnauthenticatedError) return;
			yield { type: 'error', error: 'chat_request_failed' };
			return;
		}

		if (!res.ok || !res.body) {
			yield { type: 'error', error: 'chat_request_failed' };
			return;
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					if (!line.startsWith('data: ')) continue;
					const data = line.slice(6);
					if (data === '[DONE]') {
						yield { type: 'done' };
						return;
					}
					try {
						const parsed = JSON.parse(data);
						if (parsed.error) yield { type: 'error', error: parsed.error, message: parsed.message };
						else if (parsed.type === 'sources') yield { type: 'sources', sources: parsed.sources };
						else if (parsed.type === 'chunk') yield { type: 'chunk', text: parsed.text };
						else if (parsed.type === 'title')
							yield { type: 'title', sessionId: parsed.sessionId, title: parsed.title };
					} catch {
						// ignore malformed SSE frames
					}
				}
			}
		} catch (e) {
			if (signal?.aborted || isAbortError(e)) {
				yield { type: 'done' };
				return;
			}
			yield { type: 'error', error: 'chat_stream_failed' };
			return;
		}
		yield { type: 'done' };
	}

	async getHistory(sessionId: string): Promise<MessageDto[]> {
		const res = await apiFetch(`/api/session/${sessionId}/messages`);
		if (!res.ok) throw new Error('history_fetch_failed');
		return (await res.json()) as MessageDto[];
	}
}
