/** @type {import('tailwindcss').Config} */
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { xs: '375px', sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        'surface-2': c('surface-2'),
        elevated: c('elevated'),
        fg: c('fg'),
        muted: c('muted'),
        subtle: c('subtle'),
        line: c('line'),
        'line-strong': c('line-strong'),
        accent: c('accent'),
        'accent-strong': c('accent-strong'),
        'accent-soft': c('accent-soft'),
        'on-accent': c('on-accent'),
        success: c('success'),
        'success-soft': c('success-soft'),
        warning: c('warning'),
        'warning-soft': c('warning-soft'),
        danger: c('danger'),
        'danger-soft': c('danger-soft'),
        info: c('info'),
        'info-soft': c('info-soft'),
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'Geist', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { xs: '6px', sm: '8px', md: '12px', lg: '16px', xl: '20px', '2xl': '24px' },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionTimingFunction: { out: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: { shimmer: 'shimmer 1.6s infinite', 'fade-in': 'fade-in .2s ease-out' },
    },
  },
  plugins: [],
}
