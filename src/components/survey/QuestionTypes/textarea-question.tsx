import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QuestionRendererProps } from './question-renderer';

export function TextareaQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const validation = question.validation_rules || {};
  const rows = question.ui?.rows || 4;

  return (
    <div className="space-y-2">
      <Label className="text-base font-medium leading-snug">
        {question.question_text}
        {question.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {question.ui?.helper_text && (
        <p className="text-sm text-muted-foreground">{question.ui.helper_text}</p>
      )}

      <Textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.ui?.placeholder}
        minLength={validation.min_length}
        maxLength={validation.max_length}
        rows={rows}
        disabled={disabled}
        aria-invalid={!!error}
        className="min-h-[120px] text-base rounded-xl px-4 py-3"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
