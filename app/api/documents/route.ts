import { NextResponse } from 'next/server';
import { authContext } from '@/server/infrastructure/http/container';
import { prisma } from '@/server/infrastructure/prisma-orm/prismaClient';
import { toIngestResponseDto } from '@/shared/dtos/IngestResponseDto';
import { httpErrorResponse } from '@/shared/errors/httpErrorResponse';

export async function GET() {
	try {
		const user = await authContext.requireUser();

		const docs = await prisma.document.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: 'desc' },
			include: { _count: { select: { chunks: true } } },
		});

		return NextResponse.json(docs.map(d => toIngestResponseDto(d, d._count.chunks)));
	} catch (err) {
		return httpErrorResponse(err, 'documents.list');
	}
}
