/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // ── Override default font family everywhere ──────────────
    fontFamily: {
      sans:  ['"Plus Jakarta Sans"'],
      mono:  ['"IBM Plex Mono"'],
    },
    extend: {
      colors: {
        // ── Design system tokens ──────────────────────────────
        ink:     'var(--color-ink)',          // primary text
        slate:   'var(--color-slate)',          // secondary / labels
        surface: 'var(--color-surface)',          // page background
        card:    'var(--color-card)',          // card background
        border:  'var(--color-border)',          // default border

        // ── Brand colors ──────────────────────────────────────
        accent: {
          DEFAULT: '#2563EB',        // primary action / chart primary
          dark:    '#1D4ED8',
          light:   '#3B82F6',
          subtle:  '#EFF6FF',        // hover bg, light fill
        },
        rupee: {
          DEFAULT: '#E85D2F',        // spend figures / budget alerts
          dark:    '#C44A1F',
          light:   '#FB923C',
          subtle:  '#FFF7ED',
        },

        // ── Keep legacy aliases so existing components don't break ──
        royal: {
          DEFAULT: '#2563EB',
          dark:    '#1D4ED8',
          light:   '#3B82F6',
        },
        blush: {
          DEFAULT: '#F7A8C4',
          dark:    '#f47fab',
        },
      },

      fontSize: {
        // ── Financial data sizes (monospace scale) ────────────
        'data-sm':  ['0.75rem',  { lineHeight: '1rem',    letterSpacing: '0' }],
        'data-md':  ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0' }],
        'data-lg':  ['1.125rem', { lineHeight: '1.5rem',  letterSpacing: '-0.01em' }],
        'data-xl':  ['1.5rem',   { lineHeight: '2rem',    letterSpacing: '-0.02em' }],
        'data-2xl': ['2rem',     { lineHeight: '2.5rem',  letterSpacing: '-0.03em' }],
        'data-3xl': ['2.75rem',  { lineHeight: '3rem',    letterSpacing: '-0.04em' }],
      },

      borderRadius: {
        '4xl': '2rem',
      },

      boxShadow: {
        // ── Restrained shadow system ──────────────────────────
        card:  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        panel: '0 4px 12px rgba(0,0,0,0.08)',
        modal: '0 20px 60px rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
}
