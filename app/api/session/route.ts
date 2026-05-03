import { NextResponse } from 'next/server';
import {
	authContext,
	sessionService,
	chatSessionRepo,
} from '@/server/infrastructure/http/container';
import { toSessionDto } from '@/shared/dtos/SessionDto';

export async function GET() {
	try {
		const user = await authContext.requireUser();
		const sessions = await chatSessionRepo.findByUserId(user.id);
		return NextResponse.json(sessions.map(toSessionDto));
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}

export async function POST() {
	try {
		const user = await authContext.requireUser();
		const session = await sessionService.getOrCreate(user.id, null);
		return NextResponse.json(toSessionDto(session), { status: 201 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
