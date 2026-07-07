import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../ui/Button';

export function Header() {
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
          <Button href="/login" variant="ghost">Log in</Button>
          <Button href="/signup" variant="primary">Get started</Button>
        </div>
      </div>
    </header>
  );
}
