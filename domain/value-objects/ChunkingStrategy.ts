export const CHUNKING_STRATEGY = {
	FIXED: 'FIXED',
	SENTENCE: 'SENTENCE',
	PARAGRAPH: 'PARAGRAPH',
	RECURSIVE: 'RECURSIVE',
} as const;

export type ChunkingStrategy = (typeof CHUNKING_STRATEGY)[keyof typeof CHUNKING_STRATEGY];
