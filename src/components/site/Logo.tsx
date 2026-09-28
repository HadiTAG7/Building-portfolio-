/** Neutral product mark: a rising line on the brand blue gradient. */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="pb-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0e80e7" />
          <stop offset="1" stopColor="#3646e8" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#pb-mark)" />
      <path d="M9 27.5 16.5 20l5 4.5L31 13" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="31" cy="13" r="2.6" fill="#55bb95" stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}
