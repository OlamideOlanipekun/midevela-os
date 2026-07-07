import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer style={{ background: 'var(--pine-black)', color: 'white', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '100px 0 64px' }}>
      <div className="wrap">
        <div className="footer-cols">
          {/* Brand Column */}
          <div className="footer-col" style={{ gap: '24px' }}>
            <div className="logo" style={{ color: 'white', fontSize: '28px' }}>
              <Image src="/logo-mark-light.png" alt="" width={30} height={30} style={{ objectFit: 'contain' }} />
              Midevela
            </div>
            <p className="footer-brand-desc" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '15px' }}>
              Staffing, training, and running autonomous AI retail counters for global commerce brands.
            </p>
            <div className="footer-status" style={{ background: 'rgba(197,255,74,0.1)', color: 'var(--pop-sage)', border: 'none' }}>
              <span className="footer-status-dot" style={{ background: 'var(--pop-sage)' }}></span>
              <span>System Operational</span>
            </div>
          </div>

          {/* Column 2: Product */}
          <div className="footer-col">
            <span className="footer-col-title" style={{ color: 'white', opacity: 0.4 }}>Product</span>
            <ul className="footer-col-links">
              <li><Link href="/#how" style={{ color: 'white' }}>Intelligence</Link></li>
              <li><Link href="/#channels" style={{ color: 'white' }}>Channels</Link></li>
              <li><Link href="/pricing" style={{ color: 'white' }}>Global Pricing</Link></li>
              <li><Link href="/signup" style={{ color: 'white' }}>Partner Portal</Link></li>
            </ul>
          </div>

          {/* Column 3: Integrations */}
          <div className="footer-col">
            <span className="footer-col-title" style={{ color: 'white', opacity: 0.4 }}>Connect</span>
            <ul className="footer-col-links">
              <li><Link href="/#channels" style={{ color: 'white' }}>WhatsApp Business</Link></li>
              <li><Link href="/#channels" style={{ color: 'white' }}>Instagram Direct</Link></li>
              <li><Link href="/pricing" style={{ color: 'white' }}>Paystack Sync</Link></li>
              <li><Link href="/pricing" style={{ color: 'white' }}>Custom Webhook</Link></li>
            </ul>
          </div>

          {/* Column 4: Resources */}
          <div className="footer-col">
            <span className="footer-col-title" style={{ color: 'white', opacity: 0.4 }}>Resources</span>
            <ul className="footer-col-links">
              <li><Link href="/login" style={{ color: 'white' }}>Merchant Login</Link></li>
              <li><Link href="/product%20doc/README.md" style={{ color: 'white' }}>API Reference</Link></li>
              <li><Link href="/#" style={{ color: 'white' }}>Case Studies</Link></li>
              <li><Link href="/#" style={{ color: 'white' }}>Engineering Blog</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '80px', paddingTop: '32px', color: 'rgba(255,255,255,0.4)' }}>
          <span>&copy; {new Date().getFullYear()} Midevela Technologies. All rights reserved.</span>
          <div className="footer-bottom-links">
            <Link href="/#" style={{ color: 'rgba(255,255,255,0.4)' }}>Privacy Shield</Link>
            <Link href="/#" style={{ color: 'rgba(255,255,255,0.4)' }}>Service Terms</Link>
            <Link href="/#" style={{ color: 'rgba(255,255,255,0.4)' }}>Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
