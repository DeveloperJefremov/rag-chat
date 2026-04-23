import { ChunkingStrategy } from '../value-objects/ChunkingStrategy';

interface ChunkingOptions {
	chunkSize: number;
	overlap: number;
}

export class ChunkingService {
	private chunkSize: number;
	private overlap: number;

	constructor(options: ChunkingOptions) {
		this.chunkSize = options.chunkSize;
		this.overlap = options.overlap;
	}

	chunk(text: string, strategy: ChunkingStrategy = 'RECURSIVE'): string[] {
		switch (strategy) {
			case 'FIXED':
				return this.chunkFixed(text);
			case 'SENTENCE':
				return this.chunkBySentence(text);
			case 'PARAGRAPH':
				return this.chunkByParagraph(text);
			case 'RECURSIVE':
				return this.chunkRecursive(text);
		}
	}

	private chunkFixed(text: string): string[] {
		const words = text
			.trim()
			.split(/\s+/)
			.filter(w => w.length > 0);
		if (words.length === 0) return [];
		if (words.length <= this.chunkSize) return [words.join(' ')];

		const chunks: string[] = [];
		let start = 0;
		while (start < words.length) {
			const end = Math.min(start + this.chunkSize, words.length);
			chunks.push(words.slice(start, end).join(' '));
			if (end === words.length) break;
			start += this.chunkSize - this.overlap;
		}
		return chunks;
	}

	private chunkBySentence(text: string): string[] {
		const sentences = text
			.split(/(?<=[.!?])\s+/)
			.map(s => s.trim())
			.filter(s => s.length > 0);
		if (sentences.length === 0) return [];

		const chunks: string[] = [];
		let current: string[] = [];
		let wordCount = 0;

		for (const sentence of sentences) {
			const words = sentence.split(/\s+/).length;
			if (wordCount + words > this.chunkSize && current.length > 0) {
				chunks.push(current.join(' '));
				const overlapSentences = current.slice(-Math.max(1, Math.floor(this.overlap / 10)));
				current = [...overlapSentences, sentence];
				wordCount = current.reduce((n, s) => n + s.split(/\s+/).length, 0);
			} else {
				current.push(sentence);
				wordCount += words;
			}
		}
		if (current.length > 0) chunks.push(current.join(' '));
		return chunks;
	}

	private chunkByParagraph(text: string): string[] {
		const paragraphs = text
			.split(/\n\n+/)
			.map(p => p.trim())
			.filter(p => p.length > 0);
		if (paragraphs.length === 0) return [];

		const chunks: string[] = [];
		let current: string[] = [];
		let wordCount = 0;

		for (const para of paragraphs) {
			const words = para.split(/\s+/).length;
			if (wordCount + words > this.chunkSize && current.length > 0) {
				chunks.push(current.join('\n\n'));
				current = [para];
				wordCount = words;
			} else {
				current.push(para);
				wordCount += words;
			}
		}
		if (current.length > 0) chunks.push(current.join('\n\n'));
		return chunks;
	}

	private chunkRecursive(text: string): string[] {
		const paragraphChunks = this.chunkByParagraph(text);
		const result: string[] = [];
		for (const chunk of paragraphChunks) {
			const words = chunk.split(/\s+/).filter(w => w.length > 0);
			if (words.length <= this.chunkSize) {
				result.push(chunk);
			} else {
				result.push(...this.chunkBySentence(chunk));
			}
		}
		return result.filter(c => c.trim().length > 0);
	}
}
