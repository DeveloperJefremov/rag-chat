import { NextResponse } from 'next/server';
import {
	chatSessionRepo,
	documentRepo,
	sessionService,
} from '@/server/infrastructure/http/container';
import { toIngestResponseDto } from '@/shared/dtos/IngestResponseDto';
import { withAuth } from '@/shared/http/withAuth';

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
	const session = await chatSessionRepo.findById(params.id, user.id);
	if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

	const docs = await documentRepo.findAttachedToSession(params.id, user.id);
	return docs.map(d => toIngestResponseDto(d, 0));
}, 'session.docs.list');

export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
	const body = (await req.json()) as { documentId?: string };
	if (!body.documentId) {
		return NextResponse.json({ error: 'missing_document_id' }, { status: 400 });
	}

	const session = await chatSessionRepo.findById(params.id, user.id);
	if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

	const doc = await documentRepo.findById(body.documentId, user.id);
	if (!doc) return NextResponse.json({ error: 'document_not_found' }, { status: 404 });

	const attachedCount = await documentRepo.countAttached(params.id);
	await sessionService.validateAttachedLimit(user.role, attachedCount);

	await documentRepo.attachToSession(params.id, body.documentId);
	return new NextResponse(null, { status: 204 });
}, 'session.docs.attach');
