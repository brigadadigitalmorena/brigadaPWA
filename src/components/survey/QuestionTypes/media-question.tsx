import { useRef, useState } from 'react';
import { Camera, FileUp, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSurveyFillStore } from '@/lib/store/survey-fill.store';
import { generateLocalId } from '@/lib/utils/uuid';
import { saveFileBlob, deleteFileBlob } from '@/lib/services/file-blob.service';
import { compressPhoto } from '@/lib/services/image-compression.service';
import { QuestionRendererProps } from './question-renderer';

export function MediaQuestion({
  question,
  error,
}: Omit<QuestionRendererProps, 'onChange' | 'value' | 'disabled'>) {
  const { files, setFiles, removeFile, responseId } = useSurveyFillStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const questionKey = question.question_key || question.id.toString();
  const questionFiles = files[questionKey] || [];
  const isPhoto = question.question_type === 'photo';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setPreviewError(null);

    const previews = await Promise.all(
      selectedFiles.map(async (originalFile) => {
        const file = isPhoto ? await compressPhoto(originalFile) : originalFile;
        const fileId = generateLocalId();
        await saveFileBlob(fileId, responseId || 'draft', file);

        return {
          id: fileId,
          fileId,
          file,
          previewUrl: URL.createObjectURL(file),
          fileType: question.question_type,
          questionId: questionKey,
        };
      })
    );

    setFiles(questionKey, [...questionFiles, ...previews]);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemove = async (fileId: string) => {
    const file = questionFiles.find((f) => f.id === fileId);
    if (file?.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
    }
    if (file?.fileId) {
      await deleteFileBlob(file.fileId);
    }
    removeFile(questionKey, fileId);
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

      <input
        ref={inputRef}
        type="file"
        accept={isPhoto ? 'image/*' : '*/*'}
        capture={isPhoto ? 'environment' : undefined}
        onChange={handleFileChange}
        className="hidden"
        id={`media-${question.id}`}
      />

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          size="mobile"
          className="flex-1 min-h-[80px] flex-col gap-2 rounded-xl"
          onClick={() => inputRef.current?.click()}
        >
          {isPhoto ? <Camera className="h-6 w-6" /> : <FileUp className="h-6 w-6" />}
          <span className="text-xs">
            {isPhoto ? 'Tomar foto / Galería' : 'Seleccionar archivo'}
          </span>
        </Button>
      </div>

      {previewError && (
        <p className="text-sm text-destructive">{previewError}</p>
      )}

      {questionFiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {questionFiles.map((file) => (
            <div
              key={file.id}
              className="relative rounded-xl border border-input overflow-hidden bg-muted"
            >
              {isPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={file.previewUrl}
                  alt={file.file.name}
                  className="w-full h-24 object-cover"
                  onError={() => setPreviewError('Error al cargar la vista previa')}
                />
              ) : (
                <div className="w-full h-24 flex items-center justify-center p-2 text-center text-xs break-all">
                  {file.file.name}
                </div>
              )}
              <button
                type="button"
                onClick={() => handleRemove(file.id)}
                className="absolute top-1 right-1 p-1 bg-background/90 rounded-full shadow-sm"
                aria-label="Eliminar archivo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
