import { ILLMClient } from '../../application/ports/ILLMClient';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiClient implements ILLMClient {
	private genAI: GoogleGenerativeAI;
	private model = 'gemini-2.5-flash';

	constructor() {
		if (!process.env.GOOGLE_AI_KEY) {
			throw new Error('GOOGLE_AI_KEY is not set');
		}
		this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);
	}

	async *streamMessage(prompt: string): AsyncGenerator<string> {
		const model = this.genAI.getGenerativeModel({ model: this.model });
		const result = await model.generateContentStream(prompt);
		for await (const chunk of result.stream) {
			const text = chunk.text();
			if (text) yield text;
		}
	}
}
