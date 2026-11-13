export default function Logo({ size = 24 }: { size?: number }) {
  return (<span className="inline-flex items-center gap-2 font-display font-semibold text-lg">
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden><path d="M12 9 6 16l6 7" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M26 8c-8 0-11 5-11 10 0 3 2 5 4 5 5 0 7-6 7-15Z" fill="#22D3EE" /></svg>CodeMint</span>);
}
