export interface ILLMClient {
	streamMessage(prompt: string): AsyncGenerator<string, void, unknown>;
	generateText(prompt: string): Promise<string>;
}
