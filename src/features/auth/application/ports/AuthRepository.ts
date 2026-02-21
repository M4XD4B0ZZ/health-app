export interface AuthRepository {
  getAccessToken(): Promise<string | null>;
}
