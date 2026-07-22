import { Question } from '@/lib/types';
import { TextQuestion } from './text-question';
import { TextareaQuestion } from './textarea-question';
import { DateTimeQuestion } from './datetime-question';
import { ChoiceQuestion } from './choice-question';
import { RangeQuestion } from './range-question';
import { DataListQuestion } from './data-list-question';
import { MediaQuestion } from './media-question';
import { SignatureQuestion } from './signature-question';
import { LocationQuestion } from './location-question';
import { IneQuestion } from './ine-question';

export interface QuestionRendererProps {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
}

export function QuestionRenderer(props: QuestionRendererProps) {
  const { question } = props;

  switch (question.question_type) {
    case 'text':
    case 'number':
      return <TextQuestion {...props} />;

    case 'textarea':
      return <TextareaQuestion {...props} />;

    case 'date':
    case 'datetime':
    case 'time':
      return <DateTimeQuestion {...props} />;

    case 'single_choice':
    case 'multi_choice':
    case 'yes_no':
      return <ChoiceQuestion {...props} />;

    case 'slider':
    case 'rating':
      return <RangeQuestion {...props} />;

    case 'data_list':
      return <DataListQuestion {...props} />;

    case 'photo':
    case 'file':
      return <MediaQuestion {...props} />;

    case 'signature':
      return <SignatureQuestion {...props} />;

    case 'location':
      return <LocationQuestion {...props} />;

    case 'ine_front':
    case 'ine_back':
      return <IneQuestion {...props} />;

    default:
      return (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground">
          Tipo de pregunta no soportado: {question.question_type}
        </div>
      );
  }
}
