import { useMemo, useSyncExternalStore } from 'react';
import { parseUser, subscribeSession } from '../utils/session';

const userSnapshot = () => localStorage.getItem('utilizator');
const tokenSnapshot = () => localStorage.getItem('token');
const emptySnapshot = () => null;

export function useSession() {
  const rawUser = useSyncExternalStore(subscribeSession, userSnapshot, emptySnapshot);
  const token = useSyncExternalStore(subscribeSession, tokenSnapshot, emptySnapshot);
  const utilizator = useMemo(() => parseUser(rawUser), [rawUser]);
  return { utilizator, token };
}
