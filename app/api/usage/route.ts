import { sessionService } from '@/server/infrastructure/http/container';
import { UsageDto } from '@/shared/dtos/UsageDto';
import { withAuth } from '@/shared/http/withAuth';

export const GET = withAuth(async (_req, { user }) => {
	const remaining = await sessionService.getRemaining(user.id, user.role);
	const dto: UsageDto = { remaining };
	return dto;
}, 'usage');
