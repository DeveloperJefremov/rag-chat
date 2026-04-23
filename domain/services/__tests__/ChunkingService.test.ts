import { describe, it, expect } from 'vitest';
import { ChunkingService } from '../ChunkingService';

describe('ChunkingService', () => {
	const service = new ChunkingService({ chunkSize: 10, overlap: 2 });

	it('returns single chunk for short text', () => {
		const result = service.chunk('hello world');
		expect(result).toHaveLength(1);
		expect(result[0]).toBe('hello world');
	});

	it('splits long text into overlapping chunks (FIXED)', () => {
		const words = Array.from({ length: 15 }, (_, i) => `word${i}`).join(' ');
		const result = service.chunk(words, 'FIXED');
		expect(result.length).toBeGreaterThan(1);
		const firstChunkWords = result[0].split(' ');
		const secondChunkWords = result[1].split(' ');
		expect(secondChunkWords[0]).toBe(firstChunkWords[firstChunkWords.length - 2]);
	});

	it('preserves paragraph boundaries (PARAGRAPH)', () => {
		const text = 'First paragraph text.\n\nSecond paragraph text.';
		const result = service.chunk(text, 'PARAGRAPH');
		expect(result.some(c => c.includes('First paragraph'))).toBe(true);
		expect(result.some(c => c.includes('Second paragraph'))).toBe(true);
	});

	it('filters empty chunks', () => {
		const result = service.chunk('   \n\n   ');
		expect(result).toHaveLength(0);
	});

	it('SENTENCE strategy groups sentences within word limit', () => {
		const text =
			'First sentence here. Second sentence here. Third sentence here. Fourth sentence goes long.';
		const result = service.chunk(text, 'SENTENCE');
		expect(result.length).toBeGreaterThan(0);
		result.forEach(c => expect(c.trim().length).toBeGreaterThan(0));
	});

	it('RECURSIVE falls back to sentence when paragraph exceeds limit', () => {
		const longPara = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');
		const result = service.chunk(longPara, 'RECURSIVE');
		expect(result.length).toBeGreaterThan(0);
	});
});
