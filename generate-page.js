const fs = require('fs');

const html = fs.readFileSync('midevela-homepage-mockup.html', 'utf8');

// Extract everything between <main> and </main> + <section id="proof"> ... wait, it's <main> down to <footer>
// Actually, let's extract from <main> to the end of the last <section> before <footer>.
const bodyMatch = html.match(/<main>([\s\S]*?)<\/main>/);

if (bodyMatch) {
  let jsx = bodyMatch[1];
  
  // Convert class to className
  jsx = jsx.replace(/class="/g, 'className="');
  // Convert for to htmlFor
  jsx = jsx.replace(/for="/g, 'htmlFor="');
  // Fix inline styles
  jsx = jsx.replace(/style="([^"]*)"/g, (match, styleString) => {
    const styleObj = {};
    styleString.split(';').forEach(rule => {
      if (!rule.trim()) return;
      let [key, value] = rule.split(':');
      if(key && value) {
        key = key.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        styleObj[key] = value.trim();
      }
    });
    return `style={${JSON.stringify(styleObj)}}`;
  });
  // Fix self-closing tags (input, img)
  jsx = jsx.replace(/<input([^>]*[^\/])>/g, '<input$1 />');
  jsx = jsx.replace(/<img([^>]*[^\/])>/g, '<img$1 />');

  // We need to wrap it in a React component
  const componentStr = `"use client";
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function Home() {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [showTyping, setShowTyping] = useState(true);
  const [showMessage, setShowMessage] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  useEffect(() => {
    // Scroll animations
    const fadeElements = document.querySelectorAll('.ticket, .station');
    fadeElements.forEach(el => el.classList.add('fade-up'));
    
    const io = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    
    fadeElements.forEach(el => io.observe(el));

    // Receipt animations
    const receipt = document.querySelector('.receipt');
    if (receipt) {
      const lines = receipt.querySelectorAll('.r-line, .r-card, .meter, .r-foot, .r-stamp');
      const receiptIo = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            lines.forEach(el => { (el as HTMLElement).style.animationPlayState = 'running'; });
          }
        });
      }, { threshold: 0.3 });
      receiptIo.observe(receipt);
    }

    // Auto open widget
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const greetDelay = reduceMotion ? 200 : 1100;
    
    const timer = setTimeout(() => {
      openWidget();
    }, greetDelay);
    
    return () => clearTimeout(timer);
  }, []);

  const openWidget = () => {
    setIsWidgetOpen(true);
    setTimeout(() => {
      document.getElementById('swInput')?.focus();
    }, 500);

    if (!hasGreeted) {
      setHasGreeted(true);
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduceMotion) {
        setTimeout(() => {
          setShowTyping(false);
          setShowMessage(true);
        }, 1200);
      } else {
        setShowTyping(false);
        setShowMessage(true);
      }
    }
  };

  return (
    <>
      <Header />
      <main>
        ${jsx.replace(/\$/g, '$$$$')}
      </main>
      
      <Footer />

      {/* LIVE WIDGET */}
      <button 
        className={\`sw-launcher \${!isWidgetOpen ? 'show' : ''}\`} 
        onClick={openWidget}
        aria-label="Open chat with Midevela assistant" 
        aria-expanded={isWidgetOpen}
      >
        M<span className="sw-ping" aria-hidden="true"></span>
      </button>

      <div className={\`sw-panel \${isWidgetOpen ? 'open' : ''}\`} role="dialog" aria-label="Midevela AI assistant chat" aria-live="polite">
        <div className="sw-head">
          <div className="sw-avatar">M</div>
          <div className="sw-meta">
            <div className="sw-name">Midevela Assistant</div>
            <div className="sw-status"><span className="dot2"></span> Active now</div>
          </div>
          <button className="sw-close" onClick={() => setIsWidgetOpen(false)} aria-label="Minimize chat">&times;</button>
        </div>
        <div className="sw-body">
          {showTyping && <div className="typing-indicator"><span></span><span></span><span></span></div>}
          
          {showMessage && (
            <>
              <div className="sw-bubble">Hey, welcome in! What are you shopping for today?</div>
              <div className="sw-chips">
                <button className="sw-chip" type="button">Just browsing</button>
                <button className="sw-chip" type="button">Need a recommendation</button>
                <button className="sw-chip" type="button">I have a question</button>
              </div>
            </>
          )}
          <div className="sw-inputrow">
            <input id="swInput" type="text" placeholder="Type what you're looking for…" aria-label="Message Midevela assistant" />
            <button type="button" aria-label="Send message">→</button>
          </div>
        </div>
      </div>
    </>
  );
}
`;

  fs.writeFileSync('app/src/app/page.tsx', componentStr);
  console.log('Successfully created page.tsx');
}
