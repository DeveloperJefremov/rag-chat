import { NextResponse } from 'next/server';
import {
	authContext,
	sessionService,
	chatSessionRepo,
} from '@/server/infrastructure/http/container';
import { toSessionDto } from '@/shared/dtos/SessionDto';
import { httpErrorResponse } from '@/shared/errors/httpErrorResponse';

export async function GET() {
	try {
		const user = await authContext.requireUser();
		const sessions = await chatSessionRepo.findByUserId(user.id);
		return NextResponse.json(sessions.map(toSessionDto));
	} catch (err) {
		return httpErrorResponse(err, 'session.list');
	}
}

export async function POST() {
	try {
		const user = await authContext.requireUser();
		const session = await sessionService.getOrCreate(user.id, null);
		return NextResponse.json(toSessionDto(session), { status: 201 });
	} catch (err) {
		return httpErrorResponse(err, 'session.create');
	}
}
