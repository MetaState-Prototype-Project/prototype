import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@lib/context/auth-context';
import { sleep } from '@lib/utils';
import { Placeholder } from '@components/common/placeholder';
import { Error } from '@components/ui/error';
import type { LayoutProps } from './common-layout';

export function AuthLayout({ children }: LayoutProps): JSX.Element {
  const [pending, setPending] = useState(true);

  const { user, loading, error } = useAuth();
  const { replace } = useRouter();

  useEffect(() => {
    const checkLogin = async (): Promise<void> => {
      setPending(true);

      if (user) {
        await sleep(500);
        void replace('/home');
      } else if (!loading) {
        await sleep(500);
        setPending(false);
      }
    };

    void checkLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  if (loading || pending) return <Placeholder />;

  // Show error if authentication failed
  if (error) {
    return (
      <main className='flex min-h-screen items-center justify-center'>
        <div className='w-full max-w-md p-6'>
          <Error message={error.message} />
          <div className='mt-4 text-center'>
            <p className='text-light-secondary dark:text-dark-secondary mb-4'>
              Please contact support to register your account.
            </p>
            <button
              onClick={() => window.location.reload()}
              className='bg-main-accent text-white px-4 py-2 rounded-full hover:bg-main-accent/90 transition-colors'
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
