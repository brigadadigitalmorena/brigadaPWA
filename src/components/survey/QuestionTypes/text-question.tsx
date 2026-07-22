import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QuestionRendererProps } from './question-renderer';

export function TextQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const validation = question.validation_rules || {};
  const isNumber = question.question_type === 'number';

  const inputMode = isNumber ? 'decimal' : 'text';
  const type = isNumber ? 'number' : 'text';

  return (
    <div className="space-y-2">
      <Label className="text-base font-medium leading-snug">
        {question.question_text}
        {question.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {question.ui?.helper_text && (
        <p className="text-sm text-muted-foreground">{question.ui.helper_text}</p>
      )}

      <Input
        type={type}
        inputMode={inputMode}
        inputSize="mobile"
        value={typeof value === 'string' || typeof value === 'number' ? value : ''}
        onChange={(e) => onChange(isNumber ? parseFloat(e.target.value) : e.target.value)}
        placeholder={question.ui?.placeholder}
        min={validation.min}
        max={validation.max}
        minLength={validation.min_length}
        maxLength={validation.max_length}
        pattern={validation.pattern}
        disabled={disabled}
        aria-invalid={!!error}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
