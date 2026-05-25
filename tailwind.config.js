module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        cream: {
          50:  '#FFFDF9',
          100: '#FFFBF5',
          200: '#FFF5E8',
          300: '#FFEDD8',
        },
        orange: {
          50:  '#FFF5ED',
          100: '#FFE8D6',
          200: '#FFD4B8',
          300: '#FFB88A',
          400: '#FF9C5C',
          500: '#FF8C42',
          600: '#FF7A2E',
          700: '#E8651A',
        },
        warm: {
          900: '#2D1F0E',
          800: '#3D2B14',
          700: '#5C4025',
          600: '#7A5535',
          500: '#9A7050',
        },
      },
      fontFamily: {
        nunito:  ['Nunito', 'system-ui', 'sans-serif'],
        playfair: ['Playfair Display', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.8s ease-out',
        'fade-in-up': 'fadeInUp 0.8s ease-out both',
        'zoom-in':    'zoomIn 1.2s ease-out',
        'float':      'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeInUp:  { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        zoomIn:    { '0%': { transform: 'scale(1.08)', opacity: '0.85' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        float:     { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-10px)' } },
      },
      boxShadow: {
        'warm':    '0 4px 24px rgba(255, 140, 66, 0.18)',
        'warm-lg': '0 8px 40px rgba(255, 140, 66, 0.28)',
        'cream':   '0 2px 20px rgba(255, 140, 66, 0.10)',
      },
    },
  },
  plugins: [],
}
