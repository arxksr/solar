import { useState, useEffect } from 'react';

const STORAGE_KEY = 'auth_locked_until';
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 30000;

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getStoredHash(): Promise<string> {
  return hashPassword('26989898');
}

export function AuthModal({ onAuthenticate }: { onAuthenticate: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const lockedUntil = localStorage.getItem(STORAGE_KEY);
    if (lockedUntil) {
      const remaining = parseInt(lockedUntil) - Date.now();
      if (remaining > 0) {
        setIsLocked(true);
        setLockCountdown(Math.ceil(remaining / 1000));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (lockCountdown > 0) {
      const timer = setTimeout(() => setLockCountdown(lockCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isLocked && lockCountdown === 0) {
      setIsLocked(false);
      setAttempts(0);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [lockCountdown, isLocked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLocked) return;

    setIsLoading(true);
    const inputHash = await hashPassword(password);
    const storedHash = await getStoredHash();
    setIsLoading(false);

    if (inputHash === storedHash) {
      onAuthenticate();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPassword('');

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockedUntil = Date.now() + LOCKOUT_MS;
        localStorage.setItem(STORAGE_KEY, lockedUntil.toString());
        setIsLocked(true);
        setLockCountdown(30);
        setError('Too many attempts. Locked for 30 seconds.');
      } else {
        setError(`Incorrect password. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: '32px 40px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: 360,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
            Enter Password
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#64748b' }}>
            Authentication required to access
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            disabled={isLocked}
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              border: `1.5px solid ${error ? '#ef4444' : '#e2e8f0'}`,
              fontSize: 14,
              fontWeight: 600,
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: 12,
              textAlign: 'center',
              letterSpacing: '4px',
            }}
          />

          {error && (
            <p style={{
              margin: '0 0 16px',
              fontSize: 12,
              fontWeight: 600,
              color: '#ef4444',
              textAlign: 'center',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLocked || isLoading || !password}
            style={{
              width: '100%',
              padding: '12px 24px',
              borderRadius: 10,
              border: 'none',
              background: isLocked ? '#94a3b8' : '#0f172a',
              color: 'white',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '1px',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              opacity: isLocked ? 0.7 : 1,
            }}
          >
            {isLocked ? `UNLOCK IN ${lockCountdown}s` : 'UNLOCK'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthModal;
