"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMockAuth } from '@/components/providers/MockAuthProvider';
import './auth.css';

export default function AuthShell({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const { signIn } = useMockAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [email, setEmail] = useState('');
  const [passDate, setPassDate] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const today = new Date();
    setPassDate(today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));
  }, []);

  const isSignup = mode === 'signup';
  const passAvatarChar = businessName.trim() ? businessName.trim().charAt(0).toUpperCase() : '?';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signIn(email);

    // Retrieve redirect destination and preserve mock status states
    const searchParams = new URLSearchParams(window.location.search);
    const redirectUrl = searchParams.get('redirect_url') || (isSignup ? '/onboarding' : '/dashboard');
    const mockStatus = searchParams.get('mock_status');
    const mockPlan = searchParams.get('mock_plan');

    let target = redirectUrl;
    const params = [];
    if (mockStatus) params.push(`mock_status=${mockStatus}`);
    if (mockPlan) params.push(`mock_plan=${mockPlan}`);
    if (params.length > 0) {
      target += (target.includes('?') ? '&' : '?') + params.join('&');
    }

    router.push(target);
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
          <div className="eyebrow-dark"><span className="dot"></span> ISSUING ACCESS PASS</div>
          <h1 className="display">Your counter,<br />under your name.</h1>
          <p>Every business that joins gets its own AI counter — staffed, branded, and live the moment you finish this form.</p>
        </div>

        <div className="pass-stage">
          <div className="pass" id="accessPass">
            <div className="pass-punch"></div>
            <div className="pass-head">
              <div>
                <div className="pass-kicker">MIDEVELA ACCESS PASS</div>
                <div className="pass-brand">Counter Pass</div>
              </div>
              <div className="pass-status" id="passStatus">{isSignup ? 'ISSUING…' : 'PENDING'}</div>
            </div>

            <div className="pass-id-row">
              <div className="pass-avatar" id="passAvatar">{passAvatarChar}</div>
              <div className="pass-name-block">
                <div className="pass-business-name" id="passBusinessName">{businessName || 'Your Business'}</div>
                <div className="pass-business-tag" id="passIndustry">{industry ? `Industry · ${industry}` : 'Industry · not set'}</div>
              </div>
            </div>

            <div className="pass-fields">
              <div className="pass-field">
                <div className="pf-label">Plan</div>
                <div className="pf-value" id="passPlan">Starter</div>
              </div>
              <div className="pass-field">
                <div className="pf-label">Channel</div>
                <div className="pf-value">Website + WhatsApp</div>
              </div>
            </div>

            <div className="pass-barcode" aria-hidden="true"></div>
            <div className="pass-foot">
              <span>ISSUED ON SIGNUP</span>
              <span id="passDate">{passDate}</span>
            </div>
          </div>
        </div>

        <div className="issue-bottom">
          <div className="trust-item"><div className="t-num mono">5 min</div><div className="t-label">avg. setup time</div></div>
          <div className="trust-item"><div className="t-num mono">256-bit</div><div className="t-label">encryption</div></div>
          <div className="trust-item"><div className="t-num mono">24/7</div><div className="t-label">AI uptime</div></div>
        </div>
      </div>

      {/* RIGHT: FORM PANEL */}
      <div className="form-panel">
        <div className="form-stage" data-mode={mode}>
          <div className="panel-head">
            <div className="eyebrow" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--pop-sage)', display: 'inline-block' }}></span>
              COUNTER ACCESS
            </div>
            
            {isSignup ? (
              <>
                <h2 className="display">Open your counter</h2>
                <p>Takes about five minutes. No card required to start.</p>
              </>
            ) : (
              <>
                <h2 className="display">Sign in to your counter</h2>
                <p>Pick up where you left off — your AI is already running.</p>
              </>
            )}
          </div>

          <div className="mode-toggle" role="tablist" aria-label="Choose sign in or create account">
            <button 
              className={`mode-btn ${!isSignup ? 'active' : ''}`} 
              role="tab" 
              aria-selected={!isSignup} 
              type="button"
              onClick={() => setMode('login')}
            >
              Sign in
            </button>
            <button 
              className={`mode-btn ${isSignup ? 'active' : ''}`} 
              role="tab" 
              aria-selected={isSignup} 
              type="button"
              onClick={() => setMode('signup')}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {isSignup && (
              <>
                <div className="field">
                  <label htmlFor="businessName">Business name</label>
                  <input 
                    type="text" 
                    id="businessName" 
                    placeholder="e.g. Lumina Beauty Co." 
                    autoComplete="organization" 
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="industry">Industry</label>
                    <input 
                      type="text" 
                      id="industry" 
                      placeholder="e.g. Beauty & Cosmetics" 
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="fullName">Full name</label>
                    <input type="text" id="fullName" placeholder="Your name" autoComplete="name" />
                  </div>
                </div>
              </>
            )}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input 
                type="email" 
                id="email" 
                placeholder="you@yourbusiness.com" 
                autoComplete="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="pw-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>

            {!isSignup ? (
              <div className="row-between">
                <label className="checkbox-row"><input type="checkbox" /> Stay signed in</label>
                <Link href="#" className="link-rust">Forgot password?</Link>
              </div>
            ) : (
              <div className="row-between" style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>
                <label className="checkbox-row">
                  <input type="checkbox" required /> I agree to the <Link href="#" className="link-rust" style={{ marginLeft: '3px' }}>Terms of Service</Link>
                </label>
              </div>
            )}

            <button type="submit" className="btn-primary">
              {isSignup ? 'Create my account →' : 'Sign in →'}
            </button>
          </form>

          <div className="divider">or continue with</div>

          <button type="button" className="auth-google-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px' }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>

          <p className="switch-mode" style={{ marginTop: '24px' }}>
            {isSignup ? (
              <span>Already have a counter? <button type="button" className="link-rust" style={{background:'none',border:'none',padding:0,font:'inherit',cursor:'pointer'}} onClick={() => setMode('login')}>Sign in</button></span>
            ) : (
              <span>New to Midevela? <button type="button" className="link-rust" style={{background:'none',border:'none',padding:0,font:'inherit',cursor:'pointer'}} onClick={() => setMode('signup')}>Open your counter</button></span>
            )}
          </p>

          <p className="terms-note">🔒 Protected by enterprise-grade encryption. Your data stays yours.</p>
        </div>
      </div>
    </div>
  );
}
