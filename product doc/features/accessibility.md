# Accessibility Standards

> **Project:** Midevela
>
> **Document:** Accessibility Standards
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** Frontend / Design Team

---

# Purpose

Midevela is embedded into thousands of business websites. As an infrastructure layer for commerce, our UI components (especially the Customer Widget) must be fully accessible to all users, regardless of their physical or cognitive abilities.

If our widget is inaccessible, we break accessibility compliance for our customers' websites.

---

# Target Standard

Midevela targets **WCAG 2.1 Level AA** compliance for all customer-facing interfaces (The Widget) and business-facing interfaces (The Dashboard).

---

# Core Accessibility Requirements

## 1. Keyboard Navigation
- **The Widget:** Must be fully operable without a mouse. Users must be able to Tab to the widget launcher, press `Enter` or `Space` to open it, Tab through conversation history, Tab to recommended product cards, and Tab to the input field.
- **Focus States:** Every interactive element must have a highly visible focus ring. Custom `outline: none` without a fallback focus style is strictly prohibited.
- **Focus Trapping:** When the widget modal is open, keyboard focus must be trapped inside the widget so the user doesn't accidentally tab into the background website.

## 2. Screen Reader Compatibility
- **Aria Labels:** Buttons without text (like the "Send" icon or "Close" icon) must have descriptive `aria-label`s.
- **Live Regions:** When the AI generates a new message, it must be announced to screen readers using `aria-live="polite"`.
- **Semantic HTML:** Use proper button elements `<button>` rather than clickable `<div>`s for all actions.

## 3. Color & Contrast
- **Text Contrast:** All text (including AI message bubbles, user message bubbles, and product descriptions) must maintain a minimum contrast ratio of **4.5:1** against its background.
- **Branding Adjustments:** Because businesses can customize the widget colors to match their brand, the widget code must automatically calculate contrast. If a business selects a brand color that fails contrast checks (e.g., white text on a light yellow background), the widget must automatically fallback to a darker text color for readability.

## 4. Animations & Motion
- **Reduced Motion:** If the user has `prefers-reduced-motion` enabled in their OS settings, all widget entrance animations, typing indicators, and product carousel sliding animations must be disabled, falling back to instant state changes.

---

# Testing & Validation

All frontend code must pass:
1. Automated `axe-core` accessibility audits in the CI/CD pipeline.
2. Manual keyboard-only navigation testing before any UI release.
3. VoiceOver (macOS) / NVDA (Windows) testing for new conversational components.

---

**Status:** Approved ✅
