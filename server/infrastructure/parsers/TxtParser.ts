import { IFileParser } from '../../application/ports/IFileParser';

export class TxtParser implements IFileParser {
	async parse(buffer: Buffer): Promise<string> {
		return buffer.toString('utf-8');
	}
}
