"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../ui/Button';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header>
      <div className="nav">
        <Link href="/" className="logo">
          <Image src="/logo-mark.png" alt="" width={32} height={32} className="mark-img" priority />
          Midevela
        </Link>
        <nav className="navlinks">
          <Link href="/#how">How it works</Link>
          <Link href="/#channels">Channels</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
        <div className="navcta" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Button href="/login" variant="ghost" className="navcta-login">Log in</Button>
          <Button href="/signup" variant="primary">Get started</Button>
        </div>
        <button
          type="button"
          className={`mobile-menu-btn ${menuOpen ? 'open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5H17M3 10H17M3 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className={`mobile-nav-panel ${menuOpen ? 'open' : ''}`}>
        <nav className="mobile-navlinks">
          <Link href="/#how" onClick={() => setMenuOpen(false)}>How it works</Link>
          <Link href="/#channels" onClick={() => setMenuOpen(false)}>Channels</Link>
          <Link href="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
          <Link href="/pricing" onClick={() => setMenuOpen(false)}>Pricing</Link>
          <Link href="/login" onClick={() => setMenuOpen(false)} className="mobile-login-link">Log in</Link>
        </nav>
      </div>
    </header>
  );
}
