import { FileType } from '../../domain/value-objects/FileType';

function startsWith(buf: Buffer, sig: number[]): boolean {
	if (buf.length < sig.length) return false;
	for (let i = 0; i < sig.length; i++) {
		if (buf[i] !== sig[i]) return false;
	}
	return true;
}

const KNOWN_BINARY_SIGNATURES: number[][] = [
	[0x25, 0x50, 0x44, 0x46], // %PDF
	[0x50, 0x4b, 0x03, 0x04], // PK.. — ZIP / DOCX / XLSX / JAR
	[0x50, 0x4b, 0x05, 0x06], // empty ZIP
	[0x7f, 0x45, 0x4c, 0x46], // ELF
	[0x4d, 0x5a], // MZ — Windows PE/EXE
	[0x89, 0x50, 0x4e, 0x47], // PNG
	[0xff, 0xd8, 0xff], // JPEG
	[0x47, 0x49, 0x46, 0x38], // GIF8
	[0x52, 0x61, 0x72, 0x21], // RAR!
	[0x1f, 0x8b], // gzip
];

const TXT_NULL_SCAN_BYTES = 8192;

export function verifyFileSignature(buf: Buffer, declared: FileType): boolean {
	if (declared === 'PDF') {
		return startsWith(buf, [0x25, 0x50, 0x44, 0x46]); // %PDF
	}
	if (declared === 'DOCX') {
		// DOCX is a ZIP container; accept the standard local-file-header and the
		// empty-archive markers. Deeper validation happens in the parser.
		return startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buf, [0x50, 0x4b, 0x05, 0x06]);
	}
	if (declared === 'TXT') {
		for (const sig of KNOWN_BINARY_SIGNATURES) {
			if (startsWith(buf, sig)) return false;
		}
		// Null bytes are a strong signal of a binary file masquerading as text.
		const len = Math.min(buf.length, TXT_NULL_SCAN_BYTES);
		for (let i = 0; i < len; i++) {
			if (buf[i] === 0) return false;
		}
		return true;
	}
	return false;
}
