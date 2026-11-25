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
type ChoiceButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary';

export interface ConfirmDialogOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

export interface ConfirmChoiceOption {
  id: string;
  label: string;
  variant?: ChoiceButtonVariant;
}

export interface ConfirmChoiceOptions {
  title: string;
  description?: string;
  variant?: ConfirmVariant;
  choices: ConfirmChoiceOption[];
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

interface ChoiceDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  variant?: ConfirmVariant;
  choices: ConfirmChoiceOption[];
  onChoose: (id: string | null) => void;
}

function toneClass(variant: ConfirmVariant) {
  if (variant === 'danger') {
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  }
  if (variant === 'warning') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  }
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
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
  const confirmButtonVariant = variant === 'neutral' ? 'default' : 'destructive';

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className={toneClass(variant)}>
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
            className="w-full min-h-11"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
          <Button
            variant="outline"
            size="mobile"
            className="w-full min-h-11"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ChoiceDialog({
  isOpen,
  title,
  description,
  variant = 'warning',
  choices,
  onChoose,
}: ChoiceDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onChoose(null)}>
      <AlertDialogContent size="default" className="data-[size=default]:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogMedia className={toneClass(variant)}>
            <AlertTriangle className="h-4 w-4" />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || 'Elige cómo continuar.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          {choices.map((choice) => (
            <Button
              key={choice.id}
              type="button"
              variant={choice.variant ?? 'outline'}
              size="mobile"
              className="w-full min-h-11"
              onClick={() => onChoose(choice.id)}
            >
              {choice.label}
            </Button>
          ))}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type DialogMode =
  | { kind: 'confirm'; options: ConfirmDialogOptions }
  | { kind: 'choice'; options: ConfirmChoiceOptions };

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>({
    kind: 'confirm',
    options: {
      title: 'Confirmar acción',
      description: '¿Deseas continuar?',
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
      variant: 'danger',
    },
  });

  const boolResolverRef = useRef<((value: boolean) => void) | null>(null);
  const choiceResolverRef = useRef<((value: string | null) => void) | null>(
    null
  );

  const closeBool = useCallback((value: boolean) => {
    setIsOpen(false);
    const resolver = boolResolverRef.current;
    boolResolverRef.current = null;
    if (resolver) resolver(value);
  }, []);

  const closeChoice = useCallback((value: string | null) => {
    setIsOpen(false);
    const resolver = choiceResolverRef.current;
    choiceResolverRef.current = null;
    if (resolver) resolver(value);
  }, []);

  const confirm = useCallback((nextOptions: ConfirmDialogOptions) => {
    choiceResolverRef.current = null;
    setMode({ kind: 'confirm', options: nextOptions });
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      boolResolverRef.current = resolve;
    });
  }, []);

  const confirmChoice = useCallback((nextOptions: ConfirmChoiceOptions) => {
    boolResolverRef.current = null;
    setMode({ kind: 'choice', options: nextOptions });
    setIsOpen(true);
    return new Promise<string | null>((resolve) => {
      choiceResolverRef.current = resolve;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (boolResolverRef.current) {
        boolResolverRef.current(false);
        boolResolverRef.current = null;
      }
      if (choiceResolverRef.current) {
        choiceResolverRef.current(null);
        choiceResolverRef.current = null;
      }
    };
  }, []);

  const confirmDialog = useMemo(() => {
    if (mode.kind === 'choice') {
      return (
        <ChoiceDialog
          isOpen={isOpen}
          title={mode.options.title}
          description={mode.options.description}
          variant={mode.options.variant}
          choices={mode.options.choices}
          onChoose={closeChoice}
        />
      );
    }

    return (
      <ConfirmDialog
        isOpen={isOpen}
        onConfirm={() => closeBool(true)}
        onCancel={() => closeBool(false)}
        title={mode.options.title}
        description={mode.options.description}
        confirmText={mode.options.confirmText}
        cancelText={mode.options.cancelText}
        variant={mode.options.variant}
      />
    );
  }, [isOpen, mode, closeBool, closeChoice]);

  return { confirm, confirmChoice, confirmDialog };
}
