import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import type { HelpAnchorId } from '../config/helpAnchors';

type Props = {
  /** Section id on `/admin/help` (see `HelpAnchor` in config). */
  anchor: HelpAnchorId;
  /** Link text */
  label?: string;
  className?: string;
  /** Show icon only on small screens; label visible from `sm` up (keeps top bars on one row). */
  iconOnlyBelowSm?: boolean;
};

/**
 * Contextual link to the Help centre section for the current feature.
 */
export function HelpLink({ anchor, label = 'Help', className = '', iconOnlyBelowSm = false }: Props) {
  return (
    <Link
      to={`/admin/help#${anchor}`}
      className={`inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider text-[10px] sm:text-xs transition-colors shrink-0 ${className}`}
    >
      <HelpCircle size={16} className="shrink-0 opacity-90" aria-hidden />
      {label ? (
        <span className={iconOnlyBelowSm ? 'sr-only sm:not-sr-only' : undefined}>{label}</span>
      ) : null}
    </Link>
  );
}
