import { ILLMClient } from '../../application/ports/ILLMClient';
import { GoogleGenAI } from '@google/genai';

export class GeminiClient implements ILLMClient {
	private genAI: GoogleGenAI;
	private model = 'gemini-2.5-flash';

	constructor() {
		if (!process.env.GOOGLE_AI_KEY) {
			throw new Error('GOOGLE_AI_KEY is not set');
		}
		this.genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_KEY });
	}

	async *streamMessage(prompt: string): AsyncGenerator<string> {
		const stream = await this.genAI.models.generateContentStream({
			model: this.model,
			contents: prompt,
		});
		for await (const chunk of stream) {
			const text = chunk.text;
			if (text) yield text;
		}
	}

	async generateText(prompt: string): Promise<string> {
		const response = await this.genAI.models.generateContent({
			model: this.model,
			contents: prompt,
		});
		return response.text ?? '';
	}
}
