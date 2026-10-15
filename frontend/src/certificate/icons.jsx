// SVG marks and icons used by the certificate page, taken from the reference templates.

const A8_PATHS = (
  <>
    <path
      d="M208.155 27.969C226.432 11.962 247.101 0 273.27 0C317.921 0 349.727 35.8861 350 85.6703C350 131.409 316.008 171.341 269.204 171.341C231.923 171.341 203.852 140.757 179.344 114.054C177.912 112.494 176.493 110.948 175.085 109.421L153.835 85.6703C150.297 82.125 146.727 78.3098 143.087 74.4196C125.357 55.4725 105.962 34.7452 80.4525 34.7452C76.1127 34.7347 71.7953 35.3755 67.6413 36.6467C66.0615 37.1544 64.4135 37.411 62.7559 37.4073C54.2516 37.5364 46.949 31.3143 45.626 22.8119C44.303 14.3095 49.3628 6.11742 57.4948 3.59552C65.0513 1.29145 72.902 0.126528 80.7941 0.138289C104.128 0.138289 124.079 12.1349 141.707 27.7962C160.704 44.6417 189.072 44.7155 208.155 27.969ZM269.579 136.593C296.158 136.593 316.349 112.876 316.349 85.6676H316.28C316.28 56.1429 297.149 34.7426 271.082 34.7426C266.463 34.7503 261.867 35.3899 257.417 36.6441C208.598 50.3693 207.778 121.139 256.631 134.795C260.845 135.994 265.202 136.599 269.579 136.593Z"
      fillRule="evenodd"
      clipRule="evenodd"
      fill="currentColor"
    />
    <path
      d="M142.631 120.969C136.956 114.495 127.257 113.674 120.596 119.102C108.024 129.474 94.1196 136.596 78.712 136.596C52.6797 136.596 33.5141 115.195 33.5141 85.6706C33.5388 82.1887 33.8819 78.7167 34.539 75.2989C35.8271 68.586 32.7685 61.7848 26.9206 58.3584L25.4516 57.4941C21.0314 54.8541 15.6246 54.5327 10.9293 56.6307C6.23405 58.7288 2.82635 62.989 1.77649 68.0732C0.605076 73.9109 0.00998846 79.852 0 85.8088C0 135.593 31.3618 171.479 76.5598 171.479C102.387 171.479 122.851 159.794 140.992 144.098C144.218 141.311 146.218 137.341 146.552 133.061C146.885 128.782 145.524 124.544 142.768 121.28L142.631 120.969Z"
      fill="currentColor"
    />
    <ellipse cx="82.012" cy="85.6527" rx="27.2297" ry="27.5525" transform="rotate(-4.07 82.012 85.6527)" fill="currentColor" />
  </>
);

export function A8Mark({ className, label }) {
  return (
    <svg
      className={className}
      viewBox="0 0 350 172"
      fill="none"
      style={{ color: '#000' }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {A8_PATHS}
    </svg>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

export const Icon = {
  share: () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth="2" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
      <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
    </svg>
  ),
  arrow: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  ),
  chevron: () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth="2" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  copy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  ),
  warning: () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth="2" aria-hidden="true">
      <path d="M12 3 2 21h20L12 3z" />
      <path d="M12 10v5M12 18h.01" />
    </svg>
  ),
  clock: () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  trophy: () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth="1.7" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  ),
  pin: () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth="1.7" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  tag: () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth="1.7" aria-hidden="true">
      <path d="M4 6h16l-6 9h-4z" />
      <path d="M10 15v3h4v-3M8 21h8" />
    </svg>
  ),
  calendar: () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  venue: () => (
    <svg viewBox="0 0 24 24" {...stroke} strokeWidth="1.7" aria-hidden="true">
      <path d="M3 21h18M5 21V9l7-5 7 5v12M10 21v-6h4v6" />
    </svg>
  ),
};

export function Diamond() {
  return (
    <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
      <path d="M7 1l6 6-6 6-6-6z" fill="none" stroke="currentColor" style={{ color: 'var(--maroon)' }} />
    </svg>
  );
}

export function RuleMark() {
  return (
    <svg viewBox="0 0 30 30" aria-hidden="true">
      <rect x="10" y="10" width="10" height="10" transform="rotate(45 15 15)" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ color: 'var(--gold)' }} />
      <circle cx="15" cy="15" r="1.6" style={{ fill: 'var(--maroon)' }} />
    </svg>
  );
}
