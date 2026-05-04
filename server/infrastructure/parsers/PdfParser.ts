import { IFileParser } from '../../application/ports/IFileParser';
import { createRequire } from 'module';

type PdfParseFn = (buffer: Buffer) => Promise<{ text: string }>;

let pdfParse: PdfParseFn | null = null;

function loadPdfParse(): PdfParseFn {
	if (!pdfParse) {
		const require = createRequire(import.meta.url);
		pdfParse = require('pdf-parse/lib/pdf-parse.js') as PdfParseFn;
	}
	return pdfParse;
}

export class PdfParser implements IFileParser {
	async parse(buffer: Buffer): Promise<string> {
		const fn = loadPdfParse();
		const data = await fn(buffer);
		return data.text;
	}
}
