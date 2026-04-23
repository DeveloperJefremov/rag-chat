import { IChatApi, StreamChatParams, ChatStreamEvent } from '../../application/api/IChatApi';

export class ChatApi implements IChatApi {
	async *streamChat(params: StreamChatParams): AsyncGenerator<ChatStreamEvent> {
		const res = await fetch('/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		});

		if (!res.ok || !res.body) {
			yield { type: 'error', error: 'chat_request_failed' };
			return;
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

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
					if (parsed.error) yield { type: 'error', error: parsed.error };
					else if (parsed.type === 'sources') yield { type: 'sources', sources: parsed.sources };
					else if (parsed.type === 'chunk') yield { type: 'chunk', text: parsed.text };
				} catch {
					// ignore malformed SSE frames
				}
			}
		}
		yield { type: 'done' };
	}
}
