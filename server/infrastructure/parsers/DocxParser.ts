import { IFileParser } from '../../application/ports/IFileParser';
import mammoth from 'mammoth';

export class DocxParser implements IFileParser {
	async parse(buffer: Buffer): Promise<string> {
		const result = await mammoth.extractRawText({ buffer });
		return result.value;
	}
}
