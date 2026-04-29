const I = ({ children, size = 18, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
);

export const Brush = (p) => (
  <I {...p}>
    <path d="M3 17c1.5-1.5 3-2 4.5-1.5l6-9a2 2 0 1 1 3 3l-9 6C8 17 6.5 18.5 5 18.5A2 2 0 0 1 3 17z" />
  </I>
);

export const Eraser = (p) => (
  <I {...p}>
    <path d="M3 17h14M5 17l-2-2 8-8 4 4-6 6z" />
    <path d="M11 7l2 2" />
  </I>
);

export const Send = (p) => (
  <I {...p}>
    <path d="M17 3L3 9l5.5 2.5L11 17l2-5.5L17 3z" />
  </I>
);

export const Plus = (p) => (
  <I {...p}>
    <path d="M10 4v12M4 10h12" />
  </I>
);

export const ArrowRight = (p) => (
  <I {...p}>
    <path d="M4 10h12M12 6l4 4-4 4" />
  </I>
);

export const Check = (p) => (
  <I {...p}>
    <path d="M4 10l4.5 4.5L16 6" />
  </I>
);

export const X = (p) => (
  <I {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
  </I>
);

export const Crown = (p) => (
  <I {...p}>
    <path d="M3 14l2-6 3.5 3L10 5l1.5 6L15 8l2 6H3z" />
  </I>
);

export const Copy = (p) => (
  <I {...p}>
    <rect x="8" y="8" width="9" height="9" rx="1.5" />
    <path d="M4 12V4a1 1 0 0 1 1-1h8" />
  </I>
);

export const Sparkle = (p) => (
  <I {...p}>
    <path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.22 4.22l2.12 2.12M13.66 13.66l2.12 2.12M4.22 15.78l2.12-2.12M13.66 6.34l2.12-2.12" />
    <circle cx="10" cy="10" r="2.5" />
  </I>
);

export const Refresh = (p) => (
  <I {...p}>
    <path d="M4 10a6 6 0 1 0 1.5-4" />
    <path d="M4 4v3h3" />
  </I>
);

export const Door = (p) => (
  <I {...p}>
    <rect x="4" y="2" width="12" height="17" rx="1.5" />
    <circle cx="13" cy="10.5" r="1" fill="currentColor" stroke="none" />
    <path d="M4 19h12" />
  </I>
);
