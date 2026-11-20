'use client';

import { memo, type ReactNode } from 'react';

/**
 * A provider's own state (cola de sync, perfil, tema) must not re-render the
 * router. Those urgent updates were cancelling the navigation started by the
 * first tap, so the view stayed put until a later tap or a full reload.
 * Context consumers below still update.
 */
export const StableTree = memo(function StableTree({
  children,
}: {
  children: ReactNode;
}) {
  return children;
});
