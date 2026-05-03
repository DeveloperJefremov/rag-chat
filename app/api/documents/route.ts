import { prisma } from '@/server/infrastructure/prisma-orm/prismaClient';
import { toIngestResponseDto } from '@/shared/dtos/IngestResponseDto';
import { withAuth } from '@/shared/http/withAuth';

export const GET = withAuth(async (_req, { user }) => {
	const docs = await prisma.document.findMany({
		where: { userId: user.id },
		orderBy: { createdAt: 'desc' },
		include: { _count: { select: { chunks: true } } },
	});
	return docs.map(d => toIngestResponseDto(d, d._count.chunks));
}, 'documents.list');
