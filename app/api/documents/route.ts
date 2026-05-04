import { NextResponse } from 'next/server';
import { prisma } from '@/server/infrastructure/prisma-orm/prismaClient';
import { toIngestResponseDto } from '@/shared/dtos/IngestResponseDto';
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

	const docs = await prisma.document.findMany({
		where: {
			userId: user.id,
			...(before ? { createdAt: { lt: before } } : {}),
		},
		orderBy: { createdAt: 'desc' },
		take: limit,
		include: { _count: { select: { chunks: true } } },
	});
	return docs.map(d => toIngestResponseDto(d, d._count.chunks));
}, 'documents.list');
