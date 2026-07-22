import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { AnswerOption } from '@/lib/types';
import { getRendererKind } from '@/lib/survey/question-type-registry';
import { QuestionRendererProps } from './question-renderer';

export function ImageChoiceQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const isMulti = getRendererKind(question.question_type) === 'choice_image_multi';
  const options: AnswerOption[] = question.options || [];

  const selectedValues: string[] = Array.isArray(value)
    ? value
    : value !== undefined && value !== null
      ? [String(value)]
      : [];

  const handleSingleChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleMultiChange = (optionId: string, checked: boolean) => {
    const nextValues = checked
      ? [...selectedValues, optionId]
      : selectedValues.filter((v) => v !== optionId);
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
        <div className="grid grid-cols-2 gap-3">
          {options.map((option) => (
            <label
              key={String(option.id)}
              className="flex flex-col gap-2 rounded-xl border border-input bg-background p-3"
            >
              {option.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={option.image_url}
                  alt={option.option_text}
                  className="h-24 w-full rounded-lg object-cover"
                />
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedValues.includes(String(option.id))}
                  onCheckedChange={(checked) =>
                    handleMultiChange(String(option.id), checked as boolean)
                  }
                  disabled={disabled}
                />
                <span className="text-sm font-medium">{option.option_text}</span>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <RadioGroup
          value={selectedValues[0] || ''}
          onValueChange={handleSingleChange}
          disabled={disabled}
          className="grid grid-cols-2 gap-3"
        >
          {options.map((option) => (
            <label
              key={String(option.id)}
              className="flex flex-col gap-2 rounded-xl border border-input bg-background p-3"
            >
              {option.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={option.image_url}
                  alt={option.option_text}
                  className="h-24 w-full rounded-lg object-cover"
                />
              )}
              <div className="flex items-center gap-2">
                <RadioGroupItem value={String(option.id)} />
                <span className="text-sm font-medium">{option.option_text}</span>
              </div>
            </label>
          ))}
        </RadioGroup>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
