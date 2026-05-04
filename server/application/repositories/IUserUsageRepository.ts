export interface IUserUsageRepository {
	getTodayCount(userId: string): Promise<number>;
	increment(userId: string): Promise<void>;
}
