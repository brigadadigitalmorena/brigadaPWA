import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * Envelope with two outgoing arrows — "Envíos" / outbox.
 */
export const EnviosIcon = forwardRef<SVGSVGElement, LucideProps>(
  function EnviosIcon(
    {
      color = 'currentColor',
      size = 24,
      strokeWidth = 2,
      absoluteStrokeWidth,
      className,
      ...props
    },
    ref
  ) {
    const resolvedStrokeWidth = absoluteStrokeWidth
      ? (Number(strokeWidth) * 24) / Number(size)
      : strokeWidth;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={resolvedStrokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...props}
      >
        <path d="M4 11h16v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V11Z" />
        <path d="M4 11c3.5 3 12.5 3 16 0" />
        <path d="M9.2 10.5V5" />
        <path d="M7.4 6.7 9.2 5l1.8 1.7" />
        <path d="M15.2 11V3.2" />
        <path d="M12.6 5.7 15.2 3.2 17.8 5.7" />
      </svg>
    );
  }
);
