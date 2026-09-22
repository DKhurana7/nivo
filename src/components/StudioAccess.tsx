import { useEffect, useState } from 'react';
import App from '../App';
import { api, setRemote } from '../lib/api';
import { Field, Skeleton } from './ui';
export function StudioAccess() {
  const [state, setState] = useState<'loading' | 'login' | 'app'>('loading'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function enter(user: any) {
    const data = await api('/workspace');
    setRemote({ user, ...data });
    setState('app');
  }
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        await api('/health');
        try {
          const user = await api('/session');
          if (live) await enter(user);
        } catch {
          if (live) setState('login');
        }
      } catch {
        if (live) {
          setRemote(null);
          setState('app');
        }
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  if (state === 'app') return <App />;
  return (
    <main className="access-page">
      <div className="access-brand">
        <img src="/nivo-mark.svg" width="54" height="54" alt="Nivo" />
        <span>THE ESTIMATING STUDIO</span>
        <h1>
          Every detail.
          <br />
          Accounted for.
        </h1>
        <p>
          Your projects, vendor quotations and conversations, together in one private workspace.
        </p>
      </div>
      <section className="access-form">
        {state === 'loading' ? (
          <Skeleton />
        ) : (
          <>
            <span className="eyebrow">PRIVATE BETA</span>
            <h2>Enter your studio</h2>
            <p>Use the account provided by your studio administrator.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                const d = new FormData(e.currentTarget);
                try {
                  await enter(
                    await api('/login', {
                      method: 'POST',
                      body: JSON.stringify({ email: d.get('email'), password: d.get('password') }),
                    }),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Email">
                <input name="email" type="email" autoComplete="username" required />
              </Field>
              <Field label="Password">
                <input name="password" type="password" autoComplete="current-password" required />
              </Field>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button className="button primary full" disabled={busy}>
                {busy ? 'Opening studio…' : 'Sign in'}
              </button>
            </form>
            <button
              className="text-button"
              onClick={() => {
                setRemote(null);
                setState('app');
              }}
            >
              Explore the local demo
            </button>
            <p className="small-text muted">
              The local demo saves only on this device. Studio accounts keep data on your configured
              server.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
