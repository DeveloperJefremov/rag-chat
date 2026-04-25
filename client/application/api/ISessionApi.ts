import { SessionDto } from '../../../shared/dtos/SessionDto';

export interface ISessionApi {
	getSessions(): Promise<SessionDto[]>;
	createSession(): Promise<SessionDto>;
	deleteSession(id: string): Promise<void>;
}
