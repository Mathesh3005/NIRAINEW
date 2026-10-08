// NIRAI Command & Control — Apple-Grade SaaS Theme Tokens
// Inspired by Apple Human Interface Guidelines & macOS / visionOS Pro Materials

export const theme = {
  colors: {
    background: {
      base: '#000000',     // Apple Pure Black Canvas
      surface: '#1c1c1e',  // Apple System Gray 6 (Panel / Card surface)
      elevated: '#2c2c2e', // Apple System Gray 5 (Popover / Floating widget)
      active: '#3a3a3c',   // Apple System Gray 4 (Active / Pressed surface)
      glass: 'rgba(28, 28, 30, 0.75)', // Frosted glass backdrop fill
    },
    border: {
      subtle: 'rgba(255, 255, 255, 0.08)',  // Apple 1px hairline divider
      normal: 'rgba(255, 255, 255, 0.12)',  // Card / element boundary
      focus: '#2997ff',                      // Apple Action Blue focus ring
      specular: 'rgba(255, 255, 255, 0.18)', // Top-edge light reflection
    },
    text: {
      primary: '#f5f5f7',   // Apple Parchment / SF Pro Primary
      secondary: '#86868b', // Apple System Gray Text
      muted: '#6e6e73',     // Apple Secondary System Fill / Muted
      bright: '#ffffff',    // Pure White for high emphasis
      link: '#2997ff',      // Apple Action Link Blue
    },
    status: {
      critical: '#ff453a',  // Apple System Red
      warning: '#ff9f0a',   // Apple System Orange
      nominal: '#30d158',   // Apple System Green
      info: '#0a84ff',      // Apple System Blue
    },
    telemetry: {
      aiAccent: '#bf5af2',  // Apple Intelligence Purple
      droneCyan: '#64d2ff', // Apple Light Blue / Cyan
      motherPurple: '#af52de', // Deep Apple Purple
    },
    action: {
      primary: '#0071e3',   // Signature Apple Action Blue
      primaryHover: '#0077ed',
      primaryActive: '#0062c4',
      primaryOnDark: '#2997ff',
    },
  },
  typography: {
    fontSans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif',
    fontDisplay: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif',
    fontMono: '"SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    tracking: {
      hero: '-0.03em',
      display: '-0.025em',
      body: '-0.011em',
      caption: '-0.006em',
    },
  },
  transitions: {
    duration: '180ms',
    easing: 'cubic-bezier(0.25, 1, 0.5, 1)', // Apple Fluid Spring curve
  },
  radii: {
    sm: '8px',
    md: '12px',
    lg: '18px',
    xl: '24px',
    xxl: '32px',
    full: '9999px',
    pill: '9999px',
  },
  shadows: {
    card: '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
    glass: '0 12px 32px 0 rgba(0, 0, 0, 0.37)',
    specular: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.12)',
    pill: '0 2px 8px rgba(0, 113, 227, 0.3)',
  },
};
