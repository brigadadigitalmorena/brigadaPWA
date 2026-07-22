'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogMedia,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

type ConfirmVariant = 'danger' | 'warning' | 'neutral';

export interface ConfirmDialogOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
}: ConfirmDialogProps) {
  const variantClass =
    variant === 'danger'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : variant === 'warning'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';

  const confirmButtonVariant = variant === 'neutral' ? 'default' : 'destructive';

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className={variantClass}>
            <AlertTriangle className="h-4 w-4" />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || 'Esta acción requiere confirmación.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-3 sm:flex-col">
          <Button
            variant={confirmButtonVariant}
            size="mobile"
            className="w-full"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
          <Button variant="outline" size="mobile" className="w-full" onClick={onCancel}>
            {cancelText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions>({
    title: 'Confirmar acción',
    description: '¿Deseas continuar?',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'danger',
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const closeWith = useCallback((value: boolean) => {
    setIsOpen(false);
    const resolver = resolverRef.current;
    resolverRef.current = null;
    if (resolver) resolver(value);
  }, []);

  const confirm = useCallback((nextOptions: ConfirmDialogOptions) => {
    setOptions((prev) => ({ ...prev, ...nextOptions }));
    setIsOpen(true);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }
    };
  }, []);

  const confirmDialog = useMemo(
    () => (
      <ConfirmDialog
        isOpen={isOpen}
        onConfirm={() => closeWith(true)}
        onCancel={() => closeWith(false)}
        title={options.title}
        description={options.description}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
      />
    ),
    [isOpen, options, closeWith]
  );

  return { confirm, confirmDialog };
}
