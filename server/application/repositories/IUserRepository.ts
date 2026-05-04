import { User } from '../../../domain/entities/User';

export interface IUserRepository {
	findById(id: string): Promise<User | null>;
	deleteById(id: string): Promise<void>;
}
