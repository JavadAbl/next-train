/** Microsoft-Excel-style document icon (green sheet + white X) — lucide has no Excel brand icon. */
export default function ExcelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* sheet body */}
      <path d="M14.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5L14.5 3Z" fill="#217346" />
      {/* folded corner */}
      <path d="M14.5 3 19 7.5h-3.2a1.3 1.3 0 0 1-1.3-1.3V3Z" fill="#185a38" />
      {/* the X */}
      <path
        d="M9.4 11.8l5.2 6.8M14.6 11.8l-5.2 6.8"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </svg>
  );
}
