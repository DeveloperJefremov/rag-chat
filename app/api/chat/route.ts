import { NextRequest } from 'next/server';
import {
	authContext,
	retrievalService,
	documentRepo,
	chatSessionRepo,
} from '@/server/infrastructure/http/container';
import { ChatRequestDto } from '@/shared/dtos/ChatRequestDto';
import { TOP_K_CHUNKS } from '@/shared/config/constants';

export async function POST(req: NextRequest) {
	try {
		const user = await authContext.requireUser();
		const body: ChatRequestDto = await req.json();

		if (
			!body.message ||
			!body.sessionId ||
			!Array.isArray(body.documentIds) ||
			body.documentIds.length === 0
		) {
			return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400 });
		}

		const session = await chatSessionRepo.findById(body.sessionId, user.id);
		if (!session) {
			return new Response(JSON.stringify({ error: 'session_not_found' }), { status: 404 });
		}

		const attached = await documentRepo.findAttachedToSession(body.sessionId, user.id);
		const attachedById = new Map(attached.map(d => [d.id, d]));
		for (const id of body.documentIds) {
			if (!attachedById.has(id)) {
				return new Response(JSON.stringify({ error: 'document_not_attached' }), { status: 400 });
			}
		}
		const documentNames: Record<string, string> = {};
		for (const id of body.documentIds) {
			documentNames[id] = attachedById.get(id)!.name;
		}

		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			async start(controller) {
				try {
					const gen = retrievalService.stream({
						message: body.message,
						sessionId: body.sessionId,
						documentIds: body.documentIds,
						documentNames,
						userId: user.id,
						userRole: user.role,
						chunkingStrategy: body.chunkingStrategy ?? 'RECURSIVE',
						topK: body.topK ?? TOP_K_CHUNKS,
						rerankingEnabled: body.rerankingEnabled ?? true,
					});

					for await (const event of gen) {
						if (typeof event === 'object' && 'sources' in event) {
							controller.enqueue(
								encoder.encode(
									`data: ${JSON.stringify({ type: 'sources', sources: event.sources })}\n\n`,
								),
							);
						} else if (typeof event === 'object' && 'title' in event) {
							controller.enqueue(
								encoder.encode(
									`data: ${JSON.stringify({ type: 'title', sessionId: event.sessionId, title: event.title })}\n\n`,
								),
							);
						} else if (typeof event === 'string') {
							controller.enqueue(
								encoder.encode(`data: ${JSON.stringify({ type: 'chunk', text: event })}\n\n`),
							);
						}
					}

					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				} catch (err: unknown) {
					if (err instanceof Error && err.message === 'limit_reached') {
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ error: 'limit_reached' })}\n\n`),
						);
					} else if (err instanceof Error && err.message === 'document_not_found') {
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ error: 'document_not_found' })}\n\n`),
						);
					} else {
						// eslint-disable-next-line no-console
						console.error('[chat] stream failed:', err);
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ error: 'internal_error' })}\n\n`),
						);
					}
				} finally {
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 });
		}
		return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 });
	}
}
