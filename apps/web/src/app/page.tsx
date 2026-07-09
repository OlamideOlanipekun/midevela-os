"use client";
import React, { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import Link from 'next/link';

type IconProps = {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
};

function Icon({
  children,
  size = 18,
  color = 'currentColor',
  className = '',
  style,
  strokeWidth = 2,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

const ArrowRight = (props: IconProps) => (
  <Icon {...props}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Icon>
);
const MessageSquare = (props: IconProps) => (
  <Icon {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Icon>
);
const Zap = (props: IconProps) => (
  <Icon {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Icon>
);
const ShieldCheck = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
const Globe = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </Icon>
);
const Monitor = (props: IconProps) => (
  <Icon {...props}>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </Icon>
);
const CheckCircle2 = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></Icon>
);
const TrendingUp = (props: IconProps) => (
  <Icon {...props}>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </Icon>
);
const Cpu = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 2v2" /><path d="M15 2v2" /><path d="M9 20v2" /><path d="M15 20v2" />
    <path d="M2 9h2" /><path d="M2 15h2" /><path d="M20 9h2" /><path d="M20 15h2" />
  </Icon>
);
const Lock = (props: IconProps) => (
  <Icon {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
);

export default function Home() {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const step = entry.target.getAttribute('data-step');
          if (step !== null) setActiveStep(Number(step));
        }
      });
    }, { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" });

    document.querySelectorAll('.step-card').forEach((el) => observer.observe(el));

    // Scroll-reveal: play elements in once as they enter the viewport
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    document.querySelectorAll('[data-reveal]').forEach((el) => revealObserver.observe(el));

    // Fail-safe: progressive enhancement must never permanently hide content.
    // If the observer misfires for any element (browser quirk, extreme
    // viewport, etc.), force-reveal everything shortly after load.
    const revealFallback = setTimeout(() => {
      document.querySelectorAll('[data-reveal]:not(.in-view)').forEach((el) => el.classList.add('in-view'));
    }, 2000);

    return () => {
      clearTimeout(revealFallback);
      observer.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  return (
    <>
      <Header />
      <main>
        {/* HERO SECTION */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-text">
              <div className="eyebrow" style={{ marginBottom: '32px' }}>
                <span className="accent-sage" style={{ fontSize: '20px', lineHeight: 1 }}>●</span> Now Serving · Ticket #00482
              </div>
              <h1 style={{ maxWidth: '12ch' }}>Turn every visitor into a guided <span className="accent-sage">buyer.</span></h1>
              <p className="lede" style={{ fontSize: '20px', color: 'var(--text-muted)', marginTop: '32px', maxWidth: '46ch', lineHeight: '1.5' }}>
                Midevela turns your website into a salesperson that understands intent, recommends with reason, and closes with confidence.
              </p>
              <div className="hero-actions" style={{ marginTop: '48px' }}>
                <Link href="/signup" className="btn primary">Open your counter <ArrowRight size={16} /></Link>
                <Link href="#how" className="btn ghost">See the flow</Link>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-stage">
                <div className="hero-chat">
                  <div className="hc-head">
                    <span className="hc-avatar">M</span>
                    <div>
                      <div className="hc-name">Midevela Counter</div>
                      <div className="hc-status"><span className="hc-dot"></span> AI Active · Ticket #00482</div>
                    </div>
                  </div>
                  <div className="hc-body">
                    <div className="hc-msg customer">Hi! I need a laptop for video editing. Budget is around ₦700k.</div>
                    <div className="hc-msg ai">Great budget for 4K work. From your catalog, one machine stands out:</div>
                    <div className="hc-product">
                      <div className="hc-prod-thumb"><Monitor size={20} strokeWidth={1.5} /></div>
                      <div className="hc-prod-info">
                        <span className="hc-prod-name">MacBook Air M2 · 16GB</span>
                        <span className="hc-prod-price">₦685,000</span>
                        <span className="hc-prod-why">Handles 4K timelines · In stock · Ships today</span>
                      </div>
                    </div>
                    <div className="hc-msg ai">Want me to hold it and send a Paystack link?</div>
                    <div className="hc-chips">
                      <span className="hc-chip">Yes, send the link</span>
                      <span className="hc-chip ghost">Compare options</span>
                    </div>
                  </div>
                </div>

                {/* Floating Intent Badge */}
                <div className="hc-float hc-badge">
                  <div className="eyebrow" style={{ fontSize: '9px', marginBottom: '4px' }}>Intent Detected</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--pine-black)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    High Purchase Intent
                    <span className="serif" style={{ color: 'var(--teal)', fontSize: '18px' }}>94</span>
                  </div>
                </div>

                {/* Floating Speed Chip */}
                <div className="hc-float hc-badge2">
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--pine-black)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={13} color="var(--teal)" /> Payment link ready in 38s
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="wrap">
            <div className="trust-bar" data-reveal style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              <div className="metrics" style={{ display: 'flex', gap: '64px' }}>
                <div className="metric">
                  <div className="serif" style={{ fontSize: '42px' }}>38s</div>
                  <div className="eyebrow" style={{ fontSize: '10px', marginTop: '4px' }}>Avg. Response</div>
                </div>
                <div className="metric">
                  <div className="serif" style={{ fontSize: '42px' }}>94%</div>
                  <div className="eyebrow" style={{ fontSize: '10px', marginTop: '4px' }}>Confidence</div>
                </div>
                <div className="metric">
                  <div className="serif" style={{ fontSize: '42px' }}>24/7</div>
                  <div className="eyebrow" style={{ fontSize: '10px', marginTop: '4px' }}>Availability</div>
                </div>
              </div>
              <div className="logos" style={{ display: 'flex', gap: '48px', opacity: 0.35, alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: '11px', letterSpacing: '0.3em' }}>STRIPE</span>
                <span className="mono" style={{ fontSize: '11px', letterSpacing: '0.3em' }}>SHOPIFY</span>
                <span className="mono" style={{ fontSize: '11px', letterSpacing: '0.3em' }}>LINEAR</span>
                <span className="mono" style={{ fontSize: '11px', letterSpacing: '0.3em' }}>REVOLUT</span>
              </div>
            </div>
          </div>
        </section>

        {/* BENTO FEATURES */}
        <section className="section-padding">
          <div className="wrap">
            <div className="section-head" data-reveal style={{ marginBottom: '80px' }}>
              <div className="eyebrow">The Business Brain</div>
              <h2 style={{ maxWidth: '18ch', marginTop: '24px' }}>Engineered for high-intent retail environments.</h2>
            </div>
            <div className="bento-grid">
              <div className="card-white" data-reveal style={{ gridColumn: 'span 8', minHeight: '520px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div className="eyebrow" style={{ color: 'var(--pine-black)' }}>Real-time Intent Radar</div>
                  <h3 style={{ marginTop: '16px', fontSize: '36px' }}>See the floor, not just reports.</h3>
                  <p style={{ marginTop: '16px', color: 'var(--text-muted)', maxWidth: '44ch', fontSize: '17px' }}>
                    Our proprietary radar identifies visitors ready to buy, comparing products, or stuck in checkout—giving you the perfect window for intervention.
                  </p>
                </div>
                <div className="radar-panel" style={{
                  marginTop: '48px',
                  background: 'var(--bg-cream)',
                  borderRadius: '24px',
                  flex: 1,
                  border: '1px solid rgba(0,0,0,0.05)',
                  padding: '40px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  {[
                    { loc: 'Lagos, NG', act: 'Viewing: Gaming Laptops', score: 91, status: 'Buying' },
                    { loc: 'Abuja, NG', act: 'Comparing 3 sets', score: 76, status: 'Comparing' },
                    { loc: 'London, UK', act: 'Needs delivery answer', score: 44, status: 'Stuck' }
                  ].map((visitor, i) => (
                    <div key={i} className="radar-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'white', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01)' }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', minWidth: 0 }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--bg-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Globe size={18} strokeWidth={1.5} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>Visitor — {visitor.loc}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{visitor.act}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexShrink: 0 }}>
                        <span className="mono" style={{ fontSize: '10px', background: visitor.score > 80 ? 'rgba(197,255,74,0.2)' : 'var(--bg-cream)', padding: '4px 10px', borderRadius: '99px', color: 'var(--pine-black)' }}>{visitor.status}</span>
                        <div className="serif" style={{ fontSize: '24px', color: visitor.score > 80 ? 'var(--teal)' : 'inherit' }}>{visitor.score}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-white" data-reveal style={{ gridColumn: 'span 4', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.05)', ['--reveal-delay' as string]: '0.12s' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--pine-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
                  <Zap className="accent-sage" size={28} strokeWidth={1.5} />
                </div>
                <h3 style={{ fontSize: '26px' }}>Lightweight</h3>
                <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '15px' }}>
                  &lt;100KB widget payload. Designed to sit invisibly on your storefront with zero impact on Core Web Vitals.
                </p>
              </div>

              <div className="card-white" data-reveal style={{ gridColumn: 'span 4', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--bg-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px' }}>
                  <ShieldCheck className="accent-sage" size={28} strokeWidth={1.5} />
                </div>
                <h3 style={{ fontSize: '26px' }}>Bank-grade Trust</h3>
                <p style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '15px' }}>
                  NDPR & GDPR ready. Every customer interaction is encrypted with AES-256, ensuring absolute data privacy.
                </p>
              </div>

              <div className="card-white" data-reveal style={{ gridColumn: 'span 8', border: '1px solid rgba(0,0,0,0.05)', ['--reveal-delay' as string]: '0.12s' }}>
                <div className="omni-row" style={{ display: 'flex', gap: '80px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div className="eyebrow" style={{ color: 'var(--pine-black)' }}>Omnichannel Intelligence</div>
                    <h3 style={{ marginTop: '20px', fontSize: '36px' }}>One brain, every counter.</h3>
                    <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '17px', lineHeight: '1.6' }}>
                      Midevela synchronizes conversations across Web, WhatsApp, and Instagram. A customer can switch channels and pick up exactly where they left off.
                    </p>
                  </div>
                  <div className="logos-cluster" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                    <div className="glass-card" style={{ padding: '28px', background: 'white', border: '1px solid rgba(0,0,0,0.05)' }}><Globe size={32} strokeWidth={1.2} /></div>
                    <div className="glass-card" style={{ padding: '28px', background: 'white', border: '1px solid rgba(0,0,0,0.05)' }}><MessageSquare size={32} strokeWidth={1.2} /></div>
                    <div className="glass-card" style={{ padding: '28px', background: 'white', border: '1px solid rgba(0,0,0,0.05)' }}><Monitor size={32} strokeWidth={1.2} /></div>
                    <div className="glass-card" style={{ padding: '28px', background: 'white', border: '1px solid rgba(0,0,0,0.05)' }}><Cpu size={32} strokeWidth={1.2} /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STICKY STEPPER */}
        <section className="section-padding" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="wrap sticky-wrapper">
            <div className="sticky-text" data-reveal>
              <div className="eyebrow">The Counter Process</div>
              <h2 style={{ marginTop: '32px', fontSize: 'clamp(38px, 5.5vw, 64px)' }}>Five stations.<br />One conversation.</h2>
              <p style={{ marginTop: '40px', color: 'var(--text-muted)', maxWidth: '34ch', fontSize: '20px', lineHeight: '1.5' }}>
                Every visitor moves through a curated sequence designed to build authority and eliminate friction.
              </p>
            </div>
            <div className="sticky-cards">
              {[
                { no: '01', title: 'Observe', desc: 'Analyzes user journey, session duration, and catalog engagement to predict buying stage before the first word is typed.' },
                { no: '02', title: 'Understand', desc: 'Asks contextual questions about budget, specific use-cases, and delivery urgency—mimicking your best floor staff.' },
                { no: '03', title: 'Recommend', desc: 'Presents a curated shortlist from your real-time catalog, backed by logical reasoning and technical comparisons.' },
                { no: '04', title: 'Resolve', desc: 'Automatically handles trust objections, warranty questions, and price sensitivity using your authenticated store data.' },
                { no: '05', title: 'Close', desc: 'Smoothly transition from inquiry to checkout with personalized payment links and order confirmation.' }
              ].map((step, i) => (
                <div key={i} className={`card-white step-card`} data-step={i} style={{
                  marginBottom: '48px',
                  padding: 'clamp(40px, 7vw, 96px) clamp(28px, 6vw, 80px)',
                  border: '1px solid rgba(0,0,0,0.05)',
                  transition: 'all 0.4s ease',
                  transform: activeStep === i ? 'scale(1)' : 'scale(0.96)',
                  opacity: activeStep === i ? 1 : 0.5,
                  boxShadow: activeStep === i ? 'var(--shadow-luxury)' : 'none'
                }}>
                  <div className="serif" style={{ fontSize: '80px', color: activeStep === i ? 'var(--teal)' : 'rgba(0,0,0,0.04)', marginBottom: '32px', lineHeight: 1 }}>{step.no}</div>
                  <h3 style={{ fontSize: '32px' }}>{step.title}</h3>
                  <p style={{ marginTop: '24px', color: 'var(--text-muted)', fontSize: '18px', lineHeight: '1.6' }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ANALYTICS DARK MODE */}
        <section className="dark-section section-padding" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="glow-overlay" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(197,255,74,0.08) 0%, transparent 60%)' }}></div>
          <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
            <div className="section-head" data-reveal style={{ textAlign: 'center', marginBottom: '120px' }}>
              <div className="eyebrow" style={{ color: 'var(--pop-sage)' }}>Precision Intelligence</div>
              <h2 style={{ marginTop: '24px', fontSize: 'clamp(2.25rem, 7vw, 4.5rem)', color: 'white' }}>The Command Center</h2>
            </div>
            <div className="card-white" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: 'clamp(48px, 8vw, 120px) clamp(28px, 6vw, 80px)', borderRadius: '48px' }}>
              <div className="stat-grid">
                <div className="analytic-card" data-reveal>
                  <div className="eyebrow" style={{ color: 'var(--pop-sage)', opacity: 0.9 }}>Revenue Recovered</div>
                  <div className="serif" style={{ fontSize: 'clamp(52px, 8vw, 96px)', marginTop: '20px', lineHeight: 1 }}>₦142k</div>
                  <div style={{ color: 'var(--pop-sage)', fontSize: '16px', fontWeight: 600, marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    +22% growth <TrendingUp size={16} />
                  </div>
                </div>
                <div className="analytic-card" data-reveal style={{ ['--reveal-delay' as string]: '0.12s' }}>
                  <div className="eyebrow" style={{ color: 'var(--pop-sage)', opacity: 0.9 }}>Intent Precision</div>
                  <div className="serif" style={{ fontSize: 'clamp(52px, 8vw, 96px)', marginTop: '20px', lineHeight: 1 }}>98.2%</div>
                  <div style={{ color: 'var(--pop-sage)', fontSize: '16px', fontWeight: 600, marginTop: '20px' }}>Deep Catalog Sync</div>
                </div>
                <div className="analytic-card" data-reveal style={{ ['--reveal-delay' as string]: '0.24s' }}>
                  <div className="eyebrow" style={{ color: 'var(--pop-sage)', opacity: 0.9 }}>Automation Rate</div>
                  <div className="serif" style={{ fontSize: 'clamp(52px, 8vw, 96px)', marginTop: '20px', lineHeight: 1 }}>96%</div>
                  <div style={{ color: 'var(--pop-sage)', fontSize: '16px', fontWeight: 600, marginTop: '20px' }}>Zero Hallucination Guard</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON */}
        <section className="section-padding">
          <div className="wrap">
            <div className="section-head" data-reveal style={{ textAlign: 'center', marginBottom: '100px' }}>
              <div className="eyebrow">The Evolution</div>
              <h2 style={{ marginTop: '24px', fontSize: 'clamp(2rem, 5.5vw, 3.5rem)' }}>Why standard bots fail.</h2>
            </div>
            <div className="compare-grid">
              <div className="card-white" data-reveal style={{ background: 'rgba(0,0,0,0.02)', borderStyle: 'dashed', border: '1px dashed rgba(0,0,0,0.1)' }}>
                <div className="eyebrow" style={{ marginBottom: '40px' }}>Legacy Systems</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ maxWidth: '85%', background: '#FFF', padding: '24px', borderRadius: '20px 20px 20px 4px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <p style={{ fontSize: '15px' }}>"I'm sorry, I don't understand that request. Here is a link to our FAQ page."</p>
                  </div>
                  <div style={{ maxWidth: '85%', background: '#FFF', padding: '24px', borderRadius: '20px 20px 20px 4px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <p style={{ fontSize: '15px' }}>"Would you like to speak to a human? (Current wait: 42 minutes)"</p>
                  </div>
                </div>
              </div>
              <div className="card-white" data-reveal style={{ border: '1px solid rgba(197,255,74,0.4)', position: 'relative', ['--reveal-delay' as string]: '0.15s' }}>
                <div className="eyebrow" style={{ color: 'var(--pine-black)', marginBottom: '40px' }}>Midevela Intelligence <CheckCircle2 size={12} className="accent-sage" style={{ display: 'inline', marginLeft: '6px' }} /></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ maxWidth: '90%', alignSelf: 'flex-end', background: 'var(--pine-black)', color: 'white', padding: '24px', borderRadius: '20px 20px 4px 20px', boxShadow: 'var(--shadow-luxury)' }}>
                    <p style={{ fontSize: '15px', lineHeight: '1.6' }}>"Based on your budget of ₦700k and video editing needs, I recommend the MacBook Air M2. It handles 4K editing perfectly within that price range."</p>
                  </div>
                  <div style={{ maxWidth: '90%', alignSelf: 'flex-end', background: 'var(--pine-black)', color: 'white', padding: '24px', borderRadius: '20px 20px 4px 20px', boxShadow: 'var(--shadow-luxury)' }}>
                    <p style={{ fontSize: '15px', lineHeight: '1.6' }}>"Shall I check the real-time stock at your nearest store or send a payment link?"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="section-padding" style={{ borderTop: '1px solid rgba(0,0,0,0.05)', background: 'rgba(247, 245, 240, 0.5)' }}>
          <div className="wrap">
            <div className="section-head" style={{ textAlign: 'center', marginBottom: '120px' }}>
              <div className="eyebrow">Investment</div>
              <h2 style={{ marginTop: '24px', fontSize: 'clamp(2rem, 6vw, 4rem)' }}>One counter. One price.</h2>
            </div>
            <div className="bento-grid" style={{ alignItems: 'center' }}>
              <div className="card-white" style={{ gridColumn: 'span 4', padding: 'clamp(32px, 6vw, 64px)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="eyebrow">Starter</div>
                <div className="serif" style={{ fontSize: '64px', marginTop: '32px', lineHeight: 1 }}>₦15k<span style={{ fontSize: '18px', fontWeight: 400, opacity: 0.6 }}>/mo</span></div>
                <ul style={{ marginTop: '56px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <li style={{ fontSize: '16px', color: 'var(--text-muted)' }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: '12px', color: 'var(--pine-black)' }} /> 20 catalog items</li>
                  <li style={{ fontSize: '16px', color: 'var(--text-muted)' }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: '12px', color: 'var(--pine-black)' }} /> Web Widget</li>
                  <li style={{ fontSize: '16px', color: 'var(--text-muted)' }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: '12px', color: 'var(--pine-black)' }} /> Core AI Qualification</li>
                </ul>
                <Link href="/signup" className="btn ghost" style={{ marginTop: '64px', width: '100%', justifyContent: 'center' }}>Start with Starter</Link>
              </div>

              <div className="card-white featured-lift" style={{
                gridColumn: 'span 4',
                padding: 'clamp(48px, 6vw, 96px) clamp(32px, 5vw, 64px)',
                transform: 'scale(1.1)',
                zIndex: 2,
                boxShadow: '0 50px 120px -30px rgba(0,0,0,0.2)',
                background: 'white',
                position: 'relative',
                border: '1px solid rgba(0,0,0,0.05)'
              }}>
                <div className="glow-overlay" style={{ background: 'radial-gradient(circle at top right, rgba(197,255,74,0.12) 0%, transparent 50%)' }}></div>
                <div className="eyebrow" style={{ color: 'var(--pine-black)', display: 'inline-flex', background: 'var(--pop-sage)', padding: '4px 12px', borderRadius: '99px', fontSize: '10px' }}>Most Recommended</div>
                <div className="serif" style={{ fontSize: '72px', marginTop: '32px', lineHeight: 1 }}>₦45k<span style={{ fontSize: '20px', fontWeight: 400, opacity: 0.6 }}>/mo</span></div>
                <ul style={{ marginTop: '56px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <li style={{ fontSize: '16px' }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: '12px', color: 'var(--teal)' }} /> Everything in Starter</li>
                  <li style={{ fontSize: '16px' }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: '12px', color: 'var(--teal)' }} /> Unlimited catalog sync</li>
                  <li style={{ fontSize: '16px' }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: '12px', color: 'var(--teal)' }} /> All social DMs</li>
                  <li style={{ fontSize: '16px' }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: '12px', color: 'var(--teal)' }} /> Paystack integration</li>
                </ul>
                <Link href="/signup" className="btn primary" style={{ marginTop: '64px', width: '100%', justifyContent: 'center' }}>Start with Growth</Link>
              </div>

              <div className="card-white" style={{ gridColumn: 'span 4', padding: 'clamp(32px, 6vw, 64px)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="eyebrow">Pro</div>
                <div className="serif" style={{ fontSize: '64px', marginTop: '32px', lineHeight: 1 }}>₦150k<span style={{ fontSize: '18px', fontWeight: 400, opacity: 0.6 }}>/mo</span></div>
                <ul style={{ marginTop: '56px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <li style={{ fontSize: '16px', color: 'var(--text-muted)' }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: '12px', color: 'var(--pine-black)' }} /> Everything in Growth</li>
                  <li style={{ fontSize: '16px', color: 'var(--text-muted)' }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: '12px', color: 'var(--pine-black)' }} /> Custom AI Personas</li>
                  <li style={{ fontSize: '16px', color: 'var(--text-muted)' }}><CheckCircle2 size={16} style={{ display: 'inline', marginRight: '12px', color: 'var(--pine-black)' }} /> Priority 24/7 Support</li>
                </ul>
                <Link href="/signup" className="btn ghost" style={{ marginTop: '64px', width: '100%', justifyContent: 'center' }}>Talk to sales</Link>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA & FOOTER */}
        <section className="dark-section" style={{ padding: '180px 0 0', position: 'relative' }}>
          <div className="glow-overlay" style={{ opacity: 0.4 }}></div>
          <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
            <div className="hero-grid" style={{ alignItems: 'start', marginBottom: '160px' }}>
              <div>
                <div className="eyebrow" style={{ color: 'var(--pop-sage)' }}>Ready to deploy?</div>
                <h2 style={{ marginTop: '32px', fontSize: 'clamp(2.25rem, 7vw, 5rem)', color: 'white' }}>Give your website<br />a salesperson.</h2>
                <p style={{ marginTop: '40px', opacity: 0.6, maxWidth: '34ch', fontSize: '22px', lineHeight: '1.5' }}>
                  Connect your catalog, set your brand voice, and your AI counter is live in minutes.
                </p>
                <div style={{ marginTop: '48px', display: 'flex', gap: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--pop-sage)' }}></div>
                    <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Secure Sync</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--pop-sage)' }}></div>
                    <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live 24/7</span>
                  </div>
                </div>
              </div>
              <div className="form-card" style={{ padding: '80px 64px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <h3 style={{ color: 'var(--pine-black)', marginBottom: '48px', fontSize: '36px' }}>Open your account.</h3>
                <form style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                  <input type="text" placeholder="Full name" className="input-minimal" />
                  <input type="text" placeholder="Business name" className="input-minimal" />
                  <input type="email" placeholder="Business email" className="input-minimal" />
                  <button type="submit" className="btn primary" style={{ marginTop: '24px', width: '100%', padding: '22px', justifyContent: 'center' }}>
                    Create my account <ArrowRight size={18} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: 0.5 }}>
                    <Lock size={12} color="var(--pine-black)" />
                    <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--pine-black)' }}>
                      Enterprise-grade TLS encryption
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <Footer />
        </section>
      </main>

      {/* LIVE WIDGET */}
      <button 
        className={`sw-launcher ${!isWidgetOpen ? 'show' : ''}`} 
        onClick={() => setIsWidgetOpen(true)}
        aria-label="Open chat"
        style={{ 
          width: '64px', 
          height: '64px', 
          fontSize: '18px', 
          background: 'var(--pine-black)',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)'
        }}
      >
        M
      </button>

      <div className={`sw-panel ${isWidgetOpen ? 'open' : ''}`} style={{ width: '420px', borderRadius: '32px', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.4)', border: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="sw-head" style={{ padding: '32px 32px 24px', background: 'var(--pine-black)' }}>
          <div className="sw-avatar" style={{ width: '40px', height: '40px', background: 'var(--pop-sage)', color: 'var(--pine-black)', fontWeight: 800, fontSize: '18px' }}>M</div>
          <div className="sw-meta">
            <div className="sw-name" style={{ fontSize: '18px', color: 'white' }}>Midevela Assistant</div>
            <div className="sw-status" style={{ color: 'var(--pop-sage)', fontSize: '12px' }}><span className="dot2" style={{ background: 'var(--pop-sage)', width: '6px', height: '6px' }}></span> Active now</div>
          </div>
          <button className="sw-close" onClick={() => setIsWidgetOpen(false)} style={{ fontSize: '28px', color: 'white', opacity: 0.5 }}>&times;</button>
        </div>
        <div className="sw-body" style={{ padding: '40px 32px' }}>
          <div className="sw-bubble" style={{ padding: '24px', fontSize: '16px', borderRadius: '24px 24px 24px 4px', border: '1px solid rgba(0,0,0,0.05)', background: 'var(--bg-cream)' }}>
            Hey, welcome in! What are you shopping for today?
          </div>
          <div className="sw-inputrow" style={{ marginTop: '32px', padding: '10px 10px 10px 24px', borderRadius: '99px', border: '1px solid rgba(0,0,0,0.05)', background: 'white' }}>
            <input type="text" placeholder="Type what you're looking for…" style={{ fontSize: '15px' }} />
            <button type="button" style={{ background: 'var(--pine-black)', width: '40px', height: '40px' }}><ArrowRight size={20} color="white" /></button>
          </div>
        </div>
      </div>
    </>
  );
}
