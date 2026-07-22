import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QuestionRendererProps } from './question-renderer';

export function DateTimeQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const typeMap: Record<string, string> = {
    date: 'date',
    datetime: 'datetime-local',
    time: 'time',
  };

  const inputType = typeMap[question.question_type] || 'date';

  // HTML datetime-local expects YYYY-MM-DDTHH:MM
  const formatValue = (val: unknown): string => {
    if (typeof val !== 'string') return '';
    if (question.question_type === 'datetime') {
      // Trim seconds if present
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
        value={formatValue(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        className="h-12 text-base md:text-sm"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
