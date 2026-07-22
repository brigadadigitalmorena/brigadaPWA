import { Label } from '@/components/ui/label';
import { QuestionRendererProps } from './question-renderer';

export function ReadOnlyQuestion({ question }: QuestionRendererProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
      <Label className="text-base font-medium leading-snug text-foreground">
        {question.question_text}
      </Label>
      {question.ui?.helper_text && (
        <p className="text-sm text-muted-foreground">{question.ui.helper_text}</p>
      )}
      <p className="text-sm text-muted-foreground italic">
        Campo informativo (solo lectura)
      </p>
    </div>
  );
}
