import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import { QuestionRendererProps } from './question-renderer';

export function RangeQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const validation = question.validation_rules || {};
  const isRating = question.question_type === 'rating';

  const min = Number(validation.min ?? 0);
  const max = Number(validation.max ?? (isRating ? 5 : 100));
  const step = Number(validation.step ?? 1);

  const numericValue = typeof value === 'number' ? value : min;

  if (isRating) {
    return (
      <div className="space-y-3">
        <Label className="text-base font-medium leading-snug">
          {question.question_text}
          {question.is_required && <span className="text-destructive ml-1">*</span>}
        </Label>

        {question.ui?.helper_text && (
          <p className="text-sm text-muted-foreground">{question.ui.helper_text}</p>
        )}

        <div className="flex items-center gap-2">
          {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              disabled={disabled}
              onClick={() => onChange(star)}
              className="p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              aria-label={`Calificación ${star} de ${max}`}
            >
              <Star
                size={32}
                className={
                  star <= numericValue
                    ? 'fill-primary text-primary'
                    : 'text-muted-foreground'
                }
              />
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium leading-snug">
        {question.question_text}
        {question.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {question.ui?.helper_text && (
        <p className="text-sm text-muted-foreground">{question.ui.helper_text}</p>
      )}

      <div className="flex items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numericValue}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <span className="min-w-[3ch] text-right font-medium tabular-nums">
          {numericValue}
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
