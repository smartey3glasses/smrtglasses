export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#10151B',
          800: '#161D25',
          700: '#1D2530',
          600: '#28323F'
        },
        paper: '#F5F6F4',
        line: '#E2E4DF',
        signal: {
          DEFAULT: '#146D68',
          light: '#1B8A85',
          dim: '#0E4F4C'
        },
        amber: {
          DEFAULT: '#B5750C',
          soft: '#F3E3C6'
        },
        danger: {
          DEFAULT: '#B23B32',
          soft: '#F1D9D6'
        },
        ash: {
          900: '#22262B',
          600: '#565C64',
          400: '#8A9098',
          200: '#D4D7D2'
        }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(16, 21, 27, 0.04)'
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px'
      }
    }
  },
  plugins: []
}
