"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import './auth.css';

export default function AuthShell({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passDate, setPassDate] = useState('');

  useEffect(() => {
    const today = new Date();
    setPassDate(today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
  }, []);

  const isSignup = mode === 'signup';
  const passAvatarChar = fullName.trim() ? fullName.trim().charAt(0).toUpperCase() : '?';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = isSignup
      ? await signUp({ email, password, name: fullName })
      : await signIn({ email, password });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Something went wrong. Please try again.');
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const redirectUrl = searchParams.get('redirect_url') || (isSignup ? '/onboarding' : '/dashboard');
    router.push(redirectUrl);
  };

  return (
    <div className="shell">
      {/* LEFT: ISSUING PANEL */}
      <div className="issue-panel">
        <div className="issue-top">
          <Link href="/" className="logo">
            <Image src="/logo-mark-light.png" alt="" width={26} height={26} className="mark-img" priority />
            Midevela
          </Link>
          <Link href="/" className="back-link">← Back to site</Link>
        </div>

        <div className="issue-mid">
          <div className="eyebrow-dark"><span className="dot"></span> {isSignup ? 'ISSUING ACCESS PASS' : 'WELCOME BACK'}</div>
          <h1 className="display">{isSignup ? <>Your counter,<br />under your name.</> : <>Pick up where<br />you left off.</>}</h1>
          <p>{isSignup
            ? 'Every business that joins gets its own AI counter — staffed, branded, and live the moment you finish this form.'
            : 'Sign in to manage your AI counter, review conversations, and keep your catalog current.'}</p>
        </div>

        <div className="pass-stage">
          <div className="pass" id="accessPass">
            <div className="pass-punch"></div>
            <div className="pass-head">
              <div>
                <div className="pass-kicker">MIDEVELA ACCESS PASS</div>
                <div className="pass-brand">Counter Pass</div>
              </div>
              <div className="pass-status" id="passStatus">{isSignup ? 'ISSUING…' : 'ACTIVE'}</div>
            </div>

            <div className="pass-id-row">
              <div className="pass-avatar" id="passAvatar">{passAvatarChar}</div>
              <div className="pass-name-block">
                <div className="pass-business-name" id="passBusinessName">{fullName || 'Your Name'}</div>
                <div className="pass-business-tag">{email || 'your@email.com'}</div>
              </div>
            </div>

            <div className="pass-fields">
              <div className="pass-field">
                <div className="pf-label">Plan</div>
                <div className="pf-value">14-day free trial</div>
              </div>
              <div className="pass-field">
                <div className="pf-label">Channel</div>
                <div className="pf-value">Website widget</div>
              </div>
            </div>

            <div className="pass-barcode" aria-hidden="true"></div>
            <div className="pass-foot">
              <span>{isSignup ? 'ISSUED ON SIGNUP' : 'MEMBER SINCE'}</span>
              <span id="passDate">{passDate}</span>
            </div>
          </div>
        </div>

        <div className="issue-bottom">
          <div className="trust-item">
            <span className="t-num">24/7</span>
            <span className="t-label">AI coverage</span>
          </div>
          <div className="trust-item">
            <span className="t-num">3 min</span>
            <span className="t-label">Setup time</span>
          </div>
        </div>
      </div>

      {/* RIGHT: FORM PANEL */}
      <div className="form-panel">
        <div className="form-stage">
          <div className="panel-head">
            <h2>{isSignup ? 'Create your account' : 'Sign in'}</h2>
            <p>{isSignup ? 'Start with your name, email and a password.' : 'Enter your email and password to continue.'}</p>
          </div>

          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${!isSignup ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(null); }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`mode-btn ${isSignup ? 'active' : ''}`}
              onClick={() => { setMode('signup'); setError(null); }}
            >
              Sign up
            </button>
          </div>

          {error && (
            <div style={{
              background: 'rgba(178, 58, 46, 0.08)',
              border: '1px solid var(--rust)',
              color: 'var(--rust)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isSignup && (
              <div className="field">
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Adaeze Okonkwo"
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="pw-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
                  required
                  minLength={isSignup ? 8 : undefined}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {!isSignup && (
              <div className="row-between">
                <span />
                {/* Self-serve password reset isn't built yet (needs email
                    infrastructure) — point to support rather than a dead
                    link that implies a reset flow exists. */}
                <a href="mailto:support@midevela.com?subject=Password reset" className="link-rust">
                  Forgot password? Contact support
                </a>
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Please wait…' : isSignup ? 'Create account →' : 'Sign in →'}
            </button>
          </form>

          <div className="switch-mode" style={{ marginTop: '18px' }}>
            {isSignup ? (
              <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(null); }} className="link-rust">Sign in</a></>
            ) : (
              <>Don&apos;t have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); setError(null); }} className="link-rust">Sign up</a></>
            )}
          </div>

          {isSignup && (
            <p className="terms-note">
              By creating an account you agree to Midevela&apos;s Terms of Service and Privacy Policy.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
