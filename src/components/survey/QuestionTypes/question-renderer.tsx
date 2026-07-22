import { Question } from '@/lib/types';
import { getRendererKind } from '@/lib/survey/question-type-registry';
import { TextQuestion } from './text-question';
import { TextareaQuestion } from './textarea-question';
import { DateTimeQuestion } from './datetime-question';
import { ChoiceQuestion } from './choice-question';
import { ImageChoiceQuestion } from './image-choice-question';
import { RangeQuestion } from './range-question';
import { DataListQuestion } from './data-list-question';
import { MediaQuestion } from './media-question';
import { SignatureQuestion } from './signature-question';
import { LocationQuestion } from './location-question';
import { IneQuestion } from './ine-question';
import { BarcodeQuestion } from './barcode-question';
import { ReadOnlyQuestion } from './read-only-question';
import { ZipAutofillQuestion } from './zip-autofill-question';
import { GisQuestion } from './gis-question';

export interface QuestionRendererProps {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
}

export function QuestionRenderer(props: QuestionRendererProps) {
  const { question } = props;
  const rendererKind = getRendererKind(question.question_type);

  switch (rendererKind) {
    case 'text':
    case 'number':
      return <TextQuestion {...props} />;

    case 'textarea':
      return <TextareaQuestion {...props} />;

    case 'date':
      return <DateTimeQuestion {...props} />;

    case 'choice':
    case 'choice_multi':
      return <ChoiceQuestion {...props} />;

    case 'choice_image':
    case 'choice_image_multi':
      return <ImageChoiceQuestion {...props} />;

    case 'range':
      return <RangeQuestion {...props} />;

    case 'media':
      return <MediaQuestion {...props} />;

    case 'signature':
      return <SignatureQuestion {...props} />;

    case 'location':
      return <LocationQuestion {...props} />;

    case 'gis':
      return <GisQuestion {...props} />;

    case 'ine':
      return <IneQuestion {...props} />;

    case 'barcode':
      return <BarcodeQuestion {...props} />;

    case 'readonly':
      return <ReadOnlyQuestion {...props} />;

    case 'compound_zip':
      return <ZipAutofillQuestion {...props} />;

    default:
      return (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-sm text-muted-foreground">
          Tipo de pregunta no soportado
          {question.question_type ? `: ${question.question_type}` : ''}
        </div>
      );
  }
}
