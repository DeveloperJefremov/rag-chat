import { NextRequest, NextResponse } from 'next/server';
import {
	authContext,
	chatSessionRepo,
	documentRepo,
	sessionService,
} from '@/server/infrastructure/http/container';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;

		const session = await chatSessionRepo.findById(id, user.id);
		if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

		const docs = await documentRepo.findAttachedToSession(id, user.id);
		const dtos: IngestResponseDto[] = docs.map(d => ({
			documentId: d.id,
			name: d.name,
			chunkCount: 0,
			chunkingStrategy: d.chunkingStrategy,
		}));
		return NextResponse.json(dtos);
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		// eslint-disable-next-line no-console
		console.error('[session.docs.list] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;
		const body = (await req.json()) as { documentId?: string };
		if (!body.documentId) {
			return NextResponse.json({ error: 'missing_document_id' }, { status: 400 });
		}

		const session = await chatSessionRepo.findById(id, user.id);
		if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

		const doc = await documentRepo.findById(body.documentId, user.id);
		if (!doc) return NextResponse.json({ error: 'document_not_found' }, { status: 404 });

		const attachedCount = await documentRepo.countAttached(id);
		await sessionService.validateAttachedLimit(user.role, attachedCount);

		await documentRepo.attachToSession(id, body.documentId);
		return new NextResponse(null, { status: 204 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		if (err instanceof Error && err.message === 'attached_limit_reached') {
			return NextResponse.json({ error: 'attached_limit_reached' }, { status: 403 });
		}
		// eslint-disable-next-line no-console
		console.error('[session.docs.attach] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
