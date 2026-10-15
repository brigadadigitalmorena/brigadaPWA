import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { AnswerOption } from '@/lib/types';
import { coerceYesNoValue } from '@/lib/forms/validate-answer';
import {
  getRendererKind,
  normalizeQuestionType,
} from '@/lib/survey/question-type-registry';
import { QuestionRendererProps } from './question-renderer';

const YES_NO_OPTIONS: AnswerOption[] = [
  { id: 1, question_id: 0, option_text: 'Sí', order: 0 },
  { id: 0, question_id: 0, option_text: 'No', order: 1 },
];

export function ChoiceQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const rendererKind = getRendererKind(question.question_type);
  const isMulti = rendererKind === 'choice_multi';
  const isYesNo = normalizeQuestionType(question.question_type) === 'yes_no';

  const options: AnswerOption[] = isYesNo
    ? YES_NO_OPTIONS.map((option) => ({ ...option, question_id: question.id }))
    : question.options || [];

  const selectedValues: string[] = Array.isArray(value)
    ? value.map((entry) => String(entry))
    : value !== undefined && value !== null
      ? [String(value)]
      : [];

  const yesNoSelected = isYesNo ? coerceYesNoValue(value) : undefined;
  const radioValue = isYesNo
    ? yesNoSelected === true
      ? 'true'
      : yesNoSelected === false
        ? 'false'
        : ''
    : selectedValues[0] || '';

  const handleSingleChange = (newValue: string) => {
    if (isYesNo) {
      onChange(newValue === 'true');
      return;
    }
    onChange(newValue);
  };

  const handleMultiChange = (optionId: string, checked: boolean) => {
    const option = options.find((o) => String(o.id) === optionId);
    const isExclusive = option?.is_exclusive;

    let nextValues: string[];

    if (isExclusive) {
      nextValues = checked ? [optionId] : [];
    } else {
      const current = selectedValues.filter((v) => {
        const selectedOption = options.find((o) => String(o.id) === v);
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
          value={radioValue}
          onValueChange={handleSingleChange}
          disabled={disabled}
          className="space-y-3"
        >
          {options.map((option) => (
            <label
              key={String(option.id)}
              className="flex items-center gap-3 rounded-xl border border-input bg-background p-4 min-h-12 active:bg-accent/50"
            >
              <RadioGroupItem
                value={
                  isYesNo
                    ? option.order === 0
                      ? 'true'
                      : 'false'
                    : String(option.id)
                }
                className="size-5"
              />
              <span className="text-base font-medium">{option.option_text}</span>
            </label>
          ))}
        </RadioGroup>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
