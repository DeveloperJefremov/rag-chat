import { llmOpsService } from '@/server/infrastructure/http/container';
import { withAdmin } from '@/shared/http/withAuth';

export const GET = withAdmin(async () => {
	return llmOpsService.getStats(100);
}, 'llmops.stats');
