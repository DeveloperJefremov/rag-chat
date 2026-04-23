export const FILE_TYPE = {
	PDF: 'PDF',
	TXT: 'TXT',
	DOCX: 'DOCX',
} as const;

export type FileType = (typeof FILE_TYPE)[keyof typeof FILE_TYPE];
