import type { User } from '../shared/types';

/** Current session, set once at boot and on sign-out. */
interface Session {
  user: User | null;
  devAuth: boolean;
}

export const session: Session = { user: null, devAuth: false };

export function requireSessionUser(): User {
  if (!session.user) throw new Error('No signed-in user');
  return session.user;
}
