import { NextResponse } from 'next/server';
import { sessionService, chatSessionRepo } from '@/server/infrastructure/http/container';
import { toSessionDto } from '@/shared/dtos/SessionDto';
import { withAuth } from '@/shared/http/withAuth';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export const GET = withAuth(async (req, { user }) => {
	const url = new URL(req.url);
	const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_PAGE_SIZE);
	const limit = Number.isFinite(rawLimit)
		? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(rawLimit)))
		: DEFAULT_PAGE_SIZE;
	const beforeRaw = url.searchParams.get('before');
	const before = beforeRaw ? new Date(beforeRaw) : undefined;
	if (before && Number.isNaN(before.getTime())) {
		return NextResponse.json({ error: 'invalid_before' }, { status: 400 });
	}

	const sessions = await chatSessionRepo.findByUserId(user.id, { limit, before });
	return sessions.map(toSessionDto);
}, 'session.list');

export const POST = withAuth(async (_req, { user }) => {
	const session = await sessionService.getOrCreate(user.id, null, user.role);
	return NextResponse.json(toSessionDto(session), { status: 201 });
}, 'session.create');
