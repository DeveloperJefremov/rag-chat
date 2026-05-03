import { NextResponse } from 'next/server';
import { sessionService, chatSessionRepo } from '@/server/infrastructure/http/container';
import { toSessionDto } from '@/shared/dtos/SessionDto';
import { withAuth } from '@/shared/http/withAuth';

export const GET = withAuth(async (_req, { user }) => {
	const sessions = await chatSessionRepo.findByUserId(user.id);
	return sessions.map(toSessionDto);
}, 'session.list');

export const POST = withAuth(async (_req, { user }) => {
	const session = await sessionService.getOrCreate(user.id, null);
	return NextResponse.json(toSessionDto(session), { status: 201 });
}, 'session.create');
