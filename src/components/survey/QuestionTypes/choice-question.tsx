import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { AnswerOption } from '@/lib/types';
import { QuestionRendererProps } from './question-renderer';

export function ChoiceQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const isMulti = question.question_type === 'multi_choice';
  const isYesNo = question.question_type === 'yes_no';

  const options: AnswerOption[] = isYesNo
    ? [
        { id: 1, question_id: question.id, option_text: 'Sí', order: 0 },
        { id: 2, question_id: question.id, option_text: 'No', order: 1 },
      ]
    : question.options || [];

  const selectedValues: string[] = Array.isArray(value)
    ? value
    : value !== undefined && value !== null
      ? [String(value)]
      : [];

  const handleSingleChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleMultiChange = (optionId: string, checked: boolean) => {
    const option = options.find((o) => String(o.id) === optionId);
    const isExclusive = option?.is_exclusive;

    let nextValues: string[];

    if (isExclusive) {
      // Exclusive option clears all others
      nextValues = checked ? [optionId] : [];
    } else {
      const current = selectedValues.filter((v) => {
        const selectedOption = options.find((o) => String(o.id) === v);
        // If selecting a non-exclusive option, clear any exclusive option
        return checked || !selectedOption?.is_exclusive;
      });

      nextValues = checked
        ? [...current, optionId]
        : current.filter((v) => v !== optionId);
    }

    onChange(nextValues);
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium leading-snug">
        {question.question_text}
        {question.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {question.ui?.helper_text && (
        <p className="text-sm text-muted-foreground">{question.ui.helper_text}</p>
      )}

      {isMulti ? (
        <div className="space-y-3">
          {options.map((option) => (
            <label
              key={String(option.id)}
              className="flex items-start gap-3 rounded-xl border border-input bg-background p-4 min-h-12 active:bg-accent/50"
            >
              <Checkbox
                checked={selectedValues.includes(String(option.id))}
                onCheckedChange={(checked) =>
                  handleMultiChange(String(option.id), checked as boolean)
                }
                disabled={disabled}
                className="mt-0.5 size-5"
              />
              <span className="text-base font-medium">{option.option_text}</span>
            </label>
          ))}
        </div>
      ) : (
        <RadioGroup
          value={selectedValues[0] || ''}
          onValueChange={handleSingleChange}
          disabled={disabled}
          className="space-y-3"
        >
          {options.map((option) => (
            <label
              key={String(option.id)}
              className="flex items-center gap-3 rounded-xl border border-input bg-background p-4 min-h-12 active:bg-accent/50"
            >
              <RadioGroupItem value={String(option.id)} className="size-5" />
              <span className="text-base font-medium">{option.option_text}</span>
            </label>
          ))}
        </RadioGroup>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
