import { NextResponse } from 'next/server';
import {
	authContext,
	sessionService,
	chatSessionRepo,
} from '@/server/infrastructure/http/container';
import { SessionDto } from '@/shared/dtos/SessionDto';

export async function GET() {
	try {
		const user = await authContext.requireUser();
		const sessions = await chatSessionRepo.findByUserId(user.id);
		const dtos: SessionDto[] = sessions.map(s => ({
			id: s.id,
			title: s.title,
			createdAt: s.createdAt.toISOString(),
			expiresAt: s.expiresAt.toISOString(),
		}));
		return NextResponse.json(dtos);
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
		const dto: SessionDto = {
			id: session.id,
			title: session.title,
			createdAt: session.createdAt.toISOString(),
			expiresAt: session.expiresAt.toISOString(),
		};
		return NextResponse.json(dto, { status: 201 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
