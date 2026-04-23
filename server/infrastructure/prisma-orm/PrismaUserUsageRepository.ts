import { prisma } from './prismaClient';
import { IUserUsageRepository } from '../../application/repositories/IUserUsageRepository';

export class PrismaUserUsageRepository implements IUserUsageRepository {
	async getTodayCount(userId: string): Promise<number> {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const usage = await prisma.userUsage.findUnique({
			where: { userId_date: { userId, date: today } },
		});
		return usage?.queries ?? 0;
	}

	async increment(userId: string): Promise<void> {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		await prisma.userUsage.upsert({
			where: { userId_date: { userId, date: today } },
			create: { userId, date: today, queries: 1 },
			update: { queries: { increment: 1 } },
		});
	}
}
