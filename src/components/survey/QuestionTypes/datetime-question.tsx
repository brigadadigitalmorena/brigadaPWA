import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeQuestionType } from '@/lib/survey/question-type-registry';
import { QuestionRendererProps } from './question-renderer';

export function DateTimeQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const normalizedType = normalizeQuestionType(question.question_type);

  const typeMap: Record<string, string> = {
    date: 'date',
    fecha_nacimiento: 'date',
    datetime: 'datetime-local',
    time: 'time',
  };

  const inputType = typeMap[normalizedType] || 'date';

  const formatValue = (val: unknown): string => {
    if (typeof val !== 'string') return '';
    if (normalizedType === 'datetime') {
      return val.slice(0, 16);
    }
    return val;
  };

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
        type={inputType}
        inputSize="mobile"
        value={formatValue(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
