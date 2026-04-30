import { NextResponse } from 'next/server';
import { authContext } from '@/server/infrastructure/http/container';
import { prisma } from '@/server/infrastructure/prisma-orm/prismaClient';
import { IngestResponseDto } from '@/shared/dtos/IngestResponseDto';

export async function GET() {
	try {
		const user = await authContext.requireUser();

		const docs = await prisma.document.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: 'desc' },
			include: { _count: { select: { chunks: true } } },
		});

		const dtos: IngestResponseDto[] = docs.map(d => ({
			documentId: d.id,
			name: d.name,
			chunkCount: d._count.chunks,
			createdAt: d.createdAt.toISOString(),
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
