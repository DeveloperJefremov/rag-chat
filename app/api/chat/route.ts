import { NextRequest } from 'next/server';
import {
	authContext,
	retrievalService,
	documentRepo,
} from '@/server/infrastructure/http/container';
import { ChatRequestDto } from '@/shared/dtos/ChatRequestDto';
import { TOP_K_CHUNKS } from '@/shared/config/constants';

export async function POST(req: NextRequest) {
	try {
		const user = await authContext.requireUser();
		const body: ChatRequestDto = await req.json();

		if (!body.message || !body.documentId || !body.sessionId) {
			return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400 });
		}

		// Verify document exists and belongs to the user
		const document = await documentRepo.findById(body.documentId);
		if (!document || document.userId !== user.id) {
			return new Response(JSON.stringify({ error: 'document_not_found' }), { status: 404 });
		}

		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			async start(controller) {
				try {
					const gen = retrievalService.stream({
						message: body.message,
						sessionId: body.sessionId,
						documentId: body.documentId,
						userId: user.id,
						userRole: user.role,
						documentName: document.name,
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
					} else {
						// eslint-disable-next-line no-console
						console.error('[chat] stream failed:', err);
						const message = err instanceof Error ? err.message : String(err);
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ error: 'internal_error', message })}\n\n`),
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
