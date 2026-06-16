/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Token-mapped colours — every utility maps to a CSS var
        bg:             '#0B0F12',
        surface:        '#12171C',
        'surface-2':    '#1A2127',
        accent:         '#1FB8A6',
        'accent-hover': '#28CDB9',
        success:        '#3FB984',
        warning:        '#E0A23C',
        danger:         '#E0574B',
        info:           '#4C8BD6',
        // Legacy aliases kept so existing classes don't break
        card:           '#12171C',
        teal:           '#1FB8A6',
        muted:          '#8A97A3',
        faint:          '#5B6670',
        border:         'rgba(255,255,255,0.07)',
        'border-strong':'rgba(255,255,255,0.12)',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '14px',  // keep xl = r-lg
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.4', fontWeight: '600' }],
      },
      transitionTimingFunction: {
        'ease-out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '220ms',
      },
    },
  },
  plugins: [],
};
