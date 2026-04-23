import { IIngestionApi, IngestParams } from '../api/IIngestionApi';
import { IngestResponseDto } from '../../../shared/dtos/IngestResponseDto';

export class IngestionClientService {
	constructor(private api: IIngestionApi) {}

	async upload(params: IngestParams): Promise<IngestResponseDto> {
		return this.api.ingest(params);
	}
}
