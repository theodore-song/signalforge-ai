type IconProps = { size?: number; className?: string };
const base = (size = 18) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export function RadarIcon({ size, className }: IconProps) { return <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v9l6.5-4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>; }
export function SparkIcon({ size, className }: IconProps) { return <svg {...base(size)} className={className}><path d="m13 2-2 7H4l6 4-2 8 6-6 6 4-3-8 4-5h-7z"/></svg>; }
export function ShieldIcon({ size, className }: IconProps) { return <svg {...base(size)} className={className}><path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6z"/><path d="m9 12 2 2 4-5"/></svg>; }
export function ArrowIcon({ size, className }: IconProps) { return <svg {...base(size)} className={className}><path d="M5 12h14m-5-5 5 5-5 5"/></svg>; }
export function PlusIcon({ size, className }: IconProps) { return <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14"/></svg>; }
export function RefreshIcon({ size, className }: IconProps) { return <svg {...base(size)} className={className}><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9m16 6-2 2.5A7 7 0 0 1 5.5 15"/></svg>; }
export function CloseIcon({ size, className }: IconProps) { return <svg {...base(size)} className={className}><path d="m6 6 12 12M18 6 6 18"/></svg>; }
export function SearchIcon({ size, className }: IconProps) { return <svg {...base(size)} className={className}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>; }
export function CompareIcon({ size, className }: IconProps) { return <svg {...base(size)} className={className}><path d="M8 5h12M8 12h12M8 19h12"/><circle cx="4" cy="5" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="19" r="1" fill="currentColor"/></svg>; }
export function UserIcon({ size, className }: IconProps) { return <svg {...base(size)} className={className}><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>; }
