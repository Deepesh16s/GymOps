const GRADIENT_ID = "repvyn-mark-gradient";

function BrandMarkSvg({ size = 24, gradient = true, solidColor = "#050505" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {gradient && (
        <defs>
          <linearGradient id={GRADIENT_ID} x1="4" y1="6" x2="28" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#5EEAD4" />
            <stop offset="1" stopColor="#0EA5B7" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M8 24V8h9.2c3.2 0 5.4 2 5.4 5 0 2.2-1.2 3.8-3.1 4.5L24 24h-4.6l-3.8-5.8H12V24H8Zm4-9.2h4.7c1.6 0 2.6-.8 2.6-2.2 0-1.4-1-2.2-2.6-2.2H12v4.4Z"
        fill={gradient ? `url(#${GRADIENT_ID})` : solidColor}
      />
      <path
        d="M4 24 9 15.5"
        stroke={gradient ? `url(#${GRADIENT_ID})` : solidColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M2 24 8.2 13.5"
        stroke={gradient ? `url(#${GRADIENT_ID})` : solidColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export default BrandMarkSvg;
