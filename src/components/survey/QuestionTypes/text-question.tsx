import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeQuestionType } from '@/lib/survey/question-type-registry';
import { QuestionRendererProps } from './question-renderer';

function maskToPattern(mask: string): string {
  let pattern = '^';
  for (const ch of mask) {
    if (ch === '9') pattern += '[0-9]';
    else if (ch === 'A') pattern += '[A-Za-z]';
    else if (ch === '*') pattern += '.';
    else pattern += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return `${pattern}$`;
}

export function TextQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const validation = question.validation_rules || {};
  const normalizedType = normalizeQuestionType(question.question_type);
  const isNumber =
    normalizedType === 'number' ||
    normalizedType === 'decimal' ||
    normalizedType === 'edad';

  const inputConfig: Record<
    string,
    { type: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] }
  > = {
    email: { type: 'email', inputMode: 'email' },
    phone: { type: 'tel', inputMode: 'tel' },
    curp: { type: 'text', inputMode: 'text' },
    codigo_postal: { type: 'text', inputMode: 'numeric' },
    seccion: { type: 'text', inputMode: 'text' },
    estado: { type: 'text', inputMode: 'text' },
    regex: { type: 'text', inputMode: 'text' },
    string_masked: { type: 'text', inputMode: 'text' },
    number: { type: 'number', inputMode: 'decimal' },
    decimal: { type: 'number', inputMode: 'decimal' },
    edad: { type: 'number', inputMode: 'numeric' },
    text: { type: 'text', inputMode: 'text' },
  };

  const config = inputConfig[normalizedType] ?? inputConfig.text;
  const mask = typeof validation.mask === 'string' ? validation.mask : undefined;
  const pattern =
    validation.pattern ||
    validation.regex ||
    (mask ? maskToPattern(mask) : undefined);

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
        type={config.type}
        inputMode={config.inputMode}
        inputSize="mobile"
        value={typeof value === 'string' || typeof value === 'number' ? value : ''}
        onChange={(e) =>
          onChange(
            isNumber && e.target.value !== ''
              ? Number(e.target.value)
              : e.target.value
          )
        }
        placeholder={question.ui?.placeholder}
        min={validation.min}
        max={validation.max}
        minLength={validation.min_length}
        maxLength={validation.max_length}
        pattern={pattern}
        disabled={disabled}
        aria-invalid={!!error}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
