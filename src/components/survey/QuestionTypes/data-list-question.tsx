import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSurveyFillStore } from '@/lib/store/survey-fill.store';
import { QuestionRendererProps } from './question-renderer';

export function DataListQuestion({
  question,
  value,
  onChange,
  disabled,
  error,
}: QuestionRendererProps) {
  const { version } = useSurveyFillStore();

  const dataListKey = String(question.ui?.data_list_key || question.question_key || '');
  const options: Array<{ key: string; label: string }> =
    (dataListKey && version?.data_lists?.[dataListKey] as Array<{ key: string; label: string }>) || [];

  const selectedValue = typeof value === 'string' ? value : '';

  return (
    <div className="space-y-2">
      <Label className="text-base font-medium leading-snug">
        {question.question_text}
        {question.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {question.ui?.helper_text && (
        <p className="text-sm text-muted-foreground">{question.ui.helper_text}</p>
      )}

      <Select
        value={selectedValue}
        onValueChange={onChange}
        disabled={disabled || options.length === 0}
      >
        <SelectTrigger className="w-full h-12 text-base md:text-sm">
          <SelectValue placeholder="Selecciona una opción" />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__empty__" disabled>
              No hay opciones disponibles
            </SelectItem>
          ) : (
            options.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
