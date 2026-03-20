import { Link } from 'react-router-dom';
import { CircleHelp } from 'lucide-react';
import type { HelpAnchorId } from '../config/helpAnchors';

type Props = {
  /** Section id on `/admin/help` (see `HelpAnchor` in config). */
  anchor: HelpAnchorId;
  /** Link text */
  label?: string;
  className?: string;
};

/**
 * Contextual link to the Help centre section for the current feature.
 */
export function HelpLink({ anchor, label = 'Help', className = '' }: Props) {
  return (
    <Link
      to={`/admin/help#${anchor}`}
      className={`inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider text-[10px] sm:text-xs transition-colors ${className}`}
    >
      <CircleHelp size={16} className="shrink-0 opacity-90" aria-hidden />
      {label}
    </Link>
  );
}
