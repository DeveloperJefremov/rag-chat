import { NextRequest, NextResponse } from 'next/server';
import { authContext, chatSessionRepo } from '@/server/infrastructure/http/container';
import { prisma } from '@/server/infrastructure/prisma-orm/prismaClient';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

export async function GET(req: NextRequest) {
	try {
		const user = await authContext.requireUser();
		const sessionId = req.nextUrl.searchParams.get('sessionId');
		if (!sessionId) {
			return NextResponse.json({ error: 'missing_session_id' }, { status: 400 });
		}

		const session = await chatSessionRepo.findById(sessionId, user.id);
		if (!session) {
			return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
		}

		const docs = await prisma.document.findMany({
			where: { sessionId, userId: user.id },
			orderBy: { createdAt: 'desc' },
			include: { _count: { select: { chunks: true } } },
		});

		const dtos: IngestResponseDto[] = docs.map(d => ({
			documentId: d.id,
			name: d.name,
			chunkCount: d._count.chunks,
			chunkingStrategy: d.chunkingStrategy,
		}));

		return NextResponse.json(dtos);
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		// eslint-disable-next-line no-console
		console.error('[documents.list] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
