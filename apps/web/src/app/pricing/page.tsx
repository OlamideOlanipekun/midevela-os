import React from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata = {
  title: 'Pricing — Midevela',
  description: 'Pay per business, not per seat. One recovered sale covers months of the subscription.',
};

export default function PricingPage() {
  return (
    <>
      <Header />
      <main>
        <section id="pricing" style={{ background: 'var(--paper-raised)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <div className="wrap">
            <div className="section-head">
              <div>
                <div className="eyebrow"><span className="dot"></span> PRICE TAGS, NOT SEAT LICENSES</div>
                <h1 className="display" style={{ fontSize: 'clamp(40px, 5vw, 64px)', margin: '14px 0' }}>One counter.<br />One price.</h1>
              </div>
              <p className="note">Pay per business, not per seat. One recovered sale covers months of the subscription.</p>
            </div>

            <div className="pricing-grid">
              {/* Starter */}
              <div className="price-card">
                <div className="p-name">Starter</div>
                <div className="p-price">₦15,000<span>/ month</span></div>
                <p className="p-desc">For small retailers and entrepreneurs getting started with automated sales.</p>
                <ul className="p-list">
                  <li><span className="check">✓</span> Website widget (WhatsApp — coming soon)</li>
                  <li><span className="check">✓</span> Catalog up to 20 items</li>
                  <li><span className="check">✓</span> Core AI qualification &amp; scoring</li>
                  <li><span className="check">✓</span> Standard AI sales agent</li>
                  <li><span className="check">✓</span> Real-time dashboard</li>
                  <li><span className="check">✓</span> Hot-lead WhatsApp alerts</li>
                </ul>
                <a href="/signup" className="btn ghost">Start with Starter →</a>
              </div>

              {/* Growth */}
              <div className="price-card featured">
                <div className="badge-featured">Most recommended</div>
                <div className="p-name">Growth</div>
                <div className="p-price">₦45,000<span>/ month</span></div>
                <p className="p-desc">For growing businesses handling daily customer inquiries across channels.</p>
                <ul className="p-list">
                  <li><span className="check">✓</span> Everything in Starter</li>
                  <li><span className="check">✓</span> Website widget (WhatsApp, social — coming soon)</li>
                  <li><span className="check">✓</span> Unlimited catalog items</li>
                  <li><span className="check">✓</span> Paystack payment link generation</li>
                  <li><span className="check">✓</span> Appointment booking engine</li>
                  <li><span className="check">✓</span> Revenue Leak Audit dashboard</li>
                </ul>
                <a href="/signup" className="btn primary">Start with Growth →</a>
              </div>

              {/* Pro */}
              <div className="price-card">
                <div className="p-name">Pro</div>
                <div className="p-price">₦150,000<span>/ month</span></div>
                <p className="p-desc">For established businesses needing custom AI training and dedicated support.</p>
                <ul className="p-list">
                  <li><span className="check">✓</span> Everything in Growth</li>
                  <li><span className="check">✓</span> Custom-trained AI persona</li>
                  <li><span className="check">✓</span> Multi-staff dashboard access (coming soon)</li>
                  <li><span className="check">✓</span> Predictive lead scoring</li>
                  <li><span className="check">✓</span> Priority support &amp; dedicated manager</li>
                  <li><span className="check">✓</span> Unlimited AI messages</li>
                </ul>
                <a href="/signup" className="btn ghost">Talk to sales →</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
