const bgStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  backgroundColor: '#162033',
  backgroundImage: `
    repeating-linear-gradient(
      135deg,
      transparent 0px, transparent 22px,
      rgba(255,255,255,0.03) 22px, rgba(255,255,255,0.03) 23px,
      transparent 23px, transparent 44px
    ),
    repeating-linear-gradient(
      45deg,
      transparent 0px, transparent 22px,
      rgba(255,255,255,0.025) 22px, rgba(255,255,255,0.025) 23px,
      transparent 23px, transparent 44px
    )
  `,
};

export const DraftPageBackground = () => (
  <div style={bgStyle} aria-hidden="true" />
);
