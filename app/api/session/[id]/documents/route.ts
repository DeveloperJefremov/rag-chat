import { NextRequest, NextResponse } from 'next/server';
import {
	authContext,
	chatSessionRepo,
	documentRepo,
	sessionService,
} from '@/server/infrastructure/http/container';
import { toIngestResponseDto } from '@/shared/dtos/IngestResponseDto';
import { httpErrorResponse } from '@/shared/errors/httpErrorResponse';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;

		const session = await chatSessionRepo.findById(id, user.id);
		if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

		const docs = await documentRepo.findAttachedToSession(id, user.id);
		return NextResponse.json(docs.map(d => toIngestResponseDto(d, 0)));
	} catch (err) {
		return httpErrorResponse(err, 'session.docs.list');
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
	} catch (err) {
		return httpErrorResponse(err, 'session.docs.attach');
	}
}
