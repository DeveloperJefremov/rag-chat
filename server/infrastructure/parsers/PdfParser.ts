import { IFileParser } from '../../application/ports/IFileParser';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;

export class PdfParser implements IFileParser {
	async parse(buffer: Buffer): Promise<string> {
		const data = await pdfParse(buffer);
		return data.text;
	}
}
