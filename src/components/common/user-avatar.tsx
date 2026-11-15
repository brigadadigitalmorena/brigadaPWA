'use client';

import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  /** Local object/blob URL shown immediately after picking a new photo. */
  previewUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-lg',
} as const;

const ICON_CLASS = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-7 w-7',
} as const;

function initialsFromName(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase() || 'U';
}

/**
 * Shows a profile photo with graceful fallback to initials when the remote
 * URL fails (private R2, stale CDN, offline, etc.).
 */
export function UserAvatar({
  name,
  avatarUrl,
  previewUrl,
  size = 'md',
  className,
}: UserAvatarProps) {
  const src = previewUrl || avatarUrl || null;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  const showImage = Boolean(src) && src !== failedSrc;
  const initials = initialsFromName(name);

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary',
        SIZE_CLASS[size],
        className
      )}
      aria-hidden={showImage ? undefined : true}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : name ? (
        <span>{initials}</span>
      ) : (
        <User className={ICON_CLASS[size]} />
      )}
    </div>
  );
}
