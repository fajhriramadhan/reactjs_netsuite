'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie'; // Pastikan sudah diinstal

import type { User } from '@/types/user';
import { authClient } from '@/lib/auth/client';
import { logger } from '@/lib/default-logger';

// --- Interface (DIMODIFIKASI) ---
export interface UserContextValue {
  user: User | null;
  error: string | null;
  isLoading: boolean;
  isAuthenticated: boolean; // DITAMBAHKAN: Untuk kemudahan di Guards
  checkSession: () => Promise<void>;
  signIn: (token: string) => void; // DITAMBAHKAN: Fungsi untuk login
  signOut: () => Promise<void>; // DITAMBAHKAN: Fungsi untuk logout
}

export const UserContext = React.createContext<UserContextValue | undefined>(undefined);

export interface UserProviderProps {
  children: React.ReactNode;
}

export function UserProvider({ children }: UserProviderProps): React.JSX.Element {
  // --- State (DIMODIFIKASI) ---
  const [state, setState] = React.useState<{
    user: User | null;
    error: string | null;
    isLoading: boolean;
  }>({
    user: null,
    error: null,
    isLoading: true,
  });

  const router = useRouter();

  // --- checkSession (Tetap Sama) ---
  const checkSession = React.useCallback(async (): Promise<void> => {
    try {
      // Fungsi ini kemungkinan besar bekerja dengan memeriksa HTTPOnly cookie
      // yang di-set oleh backend Anda. Kita pertahankan ini.
      const { data, error } = await authClient.getUser();

      if (error) {
        logger.error(error);
        setState((prev) => ({ ...prev, user: null, isLoading: false }));
        return;
      }

      setState((prev) => ({ ...prev, user: data ?? null, error: null, isLoading: false }));
    } catch (error) {
      logger.error(error);
      setState((prev) => ({ ...prev, user: null, isLoading: false }));
    }
  }, []);

  // --- useEffect (Tetap Sama) ---
  React.useEffect(() => {
    checkSession().catch((error) => {
      logger.error(error);
    });
  }, [checkSession]);

  // --- Fungsi signIn (DITAMBAHKAN) ---
  const signIn = React.useCallback((token: string): void => {
    // Simpan access token yang didapat dari form login ke cookies
    // Ini berguna jika 'authClient.getUser' tidak mengandalkan token ini,
    // dan kita butuh tokennya untuk request API manual.
    Cookies.set('accessToken', token, { expires: 1/12, secure: true }); // Expire dalam 2 jam

    // Setelah login berhasil, panggil checkSession untuk mengambil data user terbaru
    // dan mengupdate state secara global.
    checkSession().then(() => {
        router.push('/dashboard'); // Arahkan ke dashboard setelah data user ter-update
    }).catch(err => logger.error(err));

  }, [checkSession, router]);

  // --- Fungsi signOut (DITAMBAHKAN) ---
  const signOut = React.useCallback(async (): Promise<void> => {
    // Hapus token dari cookies
    Cookies.remove('accessToken');

    // Jika authClient Anda punya fungsi signOut, panggil di sini
    // await authClient.signOut();

    // Reset state lokal
    setState({ user: null, error: null, isLoading: false });

    // Arahkan ke halaman login
    router.push('/auth/sign-in');
  }, [router]);

  // --- Nilai Provider (DIMODIFIKASI) ---
  const memoizedValue = React.useMemo(
    () => ({
      ...state,
      isAuthenticated: state.user !== null, // isAuthenticated bernilai true jika user tidak null
      checkSession,
      signIn,
      signOut,
    }),
    [state, checkSession, signIn, signOut]
  );

  return <UserContext.Provider value={memoizedValue}>{children}</UserContext.Provider>;
}

export const UserConsumer = UserContext.Consumer;

// --- Custom Hook (DITAMBAHKAN) ---
// Ini cara modern untuk memakai context, lebih mudah daripada UserConsumer
export const useUser = (): UserContextValue => {
  const context = React.useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
