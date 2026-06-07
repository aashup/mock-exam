import type {ReactNode} from 'react';
import {Navigate} from 'react-router-dom';
import {useAuth} from '@/auth/AuthContext';
import {Spinner} from './ui/Spinner';

export function ProtectedRoute({children}: {children: ReactNode}) {
  const {isAdmin, loading} = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner label="Checking session…" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
