export interface ILLMClient {
	streamMessage(prompt: string): AsyncGenerator<string, void, unknown>;
}
