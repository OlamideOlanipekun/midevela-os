const fs = require('fs');

const htmlContent = fs.readFileSync('../../midevela-auth-mockup.html', 'utf8');

// 1. Extract CSS
const styleMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/);
if (styleMatch) {
  let css = styleMatch[1];
  // Remove the reset and :root variables as they are already in globals.css
  css = css.replace(/:root\s*{[\s\S]*?}/, '');
  css = css.replace(/\*\{box-sizing:border-box;\}/, '');
  css = css.replace(/html,body\{height:100%;\}/, '');
  css = css.replace(/body\s*{[\s\S]*?}/, '');
  css = css.replace(/a\{color:inherit;\}/, '');
  css = css.replace(/\.mono\s*{[\s\S]*?}/, '');
  css = css.replace(/\.display\s*{[\s\S]*?}/, '');
  css = css.replace(/:focus-visible\s*{[\s\S]*?}/, '');

  fs.mkdirSync('src/app/(auth)', { recursive: true });
  fs.writeFileSync('src/app/(auth)/auth.css', css.trim());
  console.log('Extracted auth.css');
}

// 2. Extract Body HTML
const bodyMatch = htmlContent.match(/<div class="shell">([\s\S]*?)<\/div>\s*<!-- RIGHT/);
let leftHtml = bodyMatch ? '<div className="shell">' + bodyMatch[1] : '';

const rightMatch = htmlContent.match(/<!-- RIGHT: FORM PANEL -->([\s\S]*?)<\/div>\s*<\/div>/);
let rightHtml = rightMatch ? '<!-- RIGHT: FORM PANEL -->' + rightMatch[1] + '</div></div>' : '';

let fullHtml = leftHtml + rightHtml;

// 3. Convert HTML to JSX
fullHtml = fullHtml.replace(/class=/g, 'className=');
fullHtml = fullHtml.replace(/for=/g, 'htmlFor=');
fullHtml = fullHtml.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');
fullHtml = fullHtml.replace(/<input([^>]*?[^\/])>/g, '<input$1 />');
fullHtml = fullHtml.replace(/style="([^"]*)"/g, (match, p1) => {
  const styles = p1.split(';').filter(s => s.trim());
  let obj = '{';
  styles.forEach(s => {
    let [key, value] = s.split(':');
    if (key && value) {
      key = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
      obj += `"${key}": "${value.trim()}", `;
    }
  });
  obj += '}';
  return `style={${obj}}`;
});

const componentCode = `"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import './auth.css';

export default function AuthShell({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');

  const isSignup = mode === 'signup';

  return (
    ${fullHtml}
  );
}
`;

fs.mkdirSync('src/components/auth', { recursive: true });
fs.writeFileSync('src/components/auth/AuthShell.tsx', componentCode);
console.log('Generated AuthShell.tsx');
