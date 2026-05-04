import { UsageDto } from '../../../shared/dtos/UsageDto';

export interface IUsageApi {
	getUsage(): Promise<UsageDto>;
}
