// NikNote logo system. Static lockups are pre-rendered SVG assets
// (see scripts/build-brand-assets.mjs); this component just picks the right one.
type Variant = 'full' | 'stacked' | 'mark' | 'mono' | 'mono-light';

const FILES: Record<Variant, string> = {
  full: '/brand/logo-primary.svg',
  stacked: '/brand/logo-stacked.svg',
  mark: '/brand/mark.svg',
  mono: '/brand/logo-mono-black.svg',
  'mono-light': '/brand/logo-mono-white.svg',
};

export function NikNoteLogo({
  variant = 'full',
  className = '',
  title = 'NikNote',
}: {
  variant?: Variant;
  className?: string;
  title?: string;
}) {
  return <img src={FILES[variant]} alt={title} className={className} draggable={false} />;
}
