'use client';

import { create } from 'zustand';
import {
  SurveyVersion,
  SurveySection,
  Question,
  LocationData,
} from '@/lib/types';
import { db, Response } from '@/lib/db/database';
import { getCurrentUser } from '@/lib/api/auth.service';
import { generateResponseId } from '@/lib/utils/uuid';
import { isRelevant } from '@/lib/utils/json-logic';
import { isFillableQuestion } from '@/lib/survey/field-types';

export interface LocalFilePreview {
  id: string;
  fileId: string;
  file: File;
  previewUrl: string;
  fileType: string;
  questionId: string;
  ineOcrData?: string;
}

export interface FillableQuestionEntry {
  question: Question;
  sectionIndex: number;
  sectionKey: string;
  sectionTitle: string;
  sectionDescription?: string;
}

interface SurveyFillState {
  surveyId: string | null;
  version: SurveyVersion | null;
  responseId: string | null;
  currentQuestionIndex: number;
  answers: Record<string, unknown>;
  files: Record<string, LocalFilePreview[]>;
  location: LocationData | null;
  startedAt: string | null;
  isLoading: boolean;
  error: string | null;
  isHydrated: boolean;

  init: (surveyId: string, version: SurveyVersion) => Promise<void>;
  saveDraft: () => Promise<void>;
  setAnswer: (questionKey: string, value: unknown) => void;
  setFiles: (questionKey: string, files: LocalFilePreview[]) => void;
  removeFile: (questionKey: string, fileId: string) => void;
  setLocation: (location: LocationData | null) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  goToQuestion: (index: number) => void;
  goToSection: (sectionIndex: number) => void;
  reset: () => void;
  getFillableQuestions: () => FillableQuestionEntry[];
  getCurrentQuestionEntry: () => FillableQuestionEntry | null;
  getVisibleQuestions: (section: SurveySection) => Question[];
  getProgress: () => number;
}

const initialState: Omit<
  SurveyFillState,
  | 'init'
  | 'saveDraft'
  | 'setAnswer'
  | 'setFiles'
  | 'removeFile'
  | 'setLocation'
  | 'nextQuestion'
  | 'prevQuestion'
  | 'goToQuestion'
  | 'goToSection'
  | 'reset'
  | 'getFillableQuestions'
  | 'getCurrentQuestionEntry'
  | 'getVisibleQuestions'
  | 'getProgress'
> = {
  surveyId: null,
  version: null,
  responseId: null,
  currentQuestionIndex: 0,
  answers: {},
  files: {},
  location: null,
  startedAt: null,
  isLoading: false,
  error: null,
  isHydrated: false,
};

function getAppVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0';
}

function buildFillableQuestions(
  version: SurveyVersion | null,
  answers: Record<string, unknown>
): FillableQuestionEntry[] {
  if (!version?.sections) return [];

  const entries: FillableQuestionEntry[] = [];

  version.sections.forEach((section, sectionIndex) => {
    const visibleQuestions =
      section.questions?.filter(
        (question) =>
          isFillableQuestion(question) &&
          isRelevant(question.relevance_expression, answers)
      ) ?? [];

    visibleQuestions.forEach((question) => {
      entries.push({
        question,
        sectionIndex,
        sectionKey: section.section_key,
        sectionTitle: section.title,
        sectionDescription: section.description,
      });
    });
  });

  return entries;
}

function buildDraftResponse(
  state: SurveyFillState,
  user: { id: number; nombre: string; apellido: string; role_key: string }
): Response {
  const now = new Date().toISOString();
  const startedAt = state.startedAt || now;

  return {
    response_id: state.responseId!,
    survey_id: state.surveyId!,
    survey_version: state.version!.version_number.toString(),
    status: 'draft',
    answers_json: JSON.stringify(state.answers),
    brigadista_user_id: user.id.toString(),
    brigadista_name: `${user.nombre} ${user.apellido}`,
    brigadista_role: user.role_key,
    latitude: state.location?.latitude,
    longitude: state.location?.longitude,
    accuracy: state.location?.accuracy,
    location_captured_at: state.location?.captured_at,
    device_platform: 'web',
    device_os_version: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    device_app_version: getAppVersion(),
    started_at: startedAt,
    validation_status: 'pending',
    sync_status: 'pending',
    sync_attempts: 0,
    offline_mode: true,
    immutable: false,
    created_at: startedAt,
    updated_at: now,
  };
}

export const useSurveyFillStore = create<SurveyFillState>((set, get) => ({
  ...initialState,

  init: async (surveyId, version) => {
    set({ isLoading: true, error: null });

    try {
      const surveyVersion = version.version_number.toString();

      const existingDrafts = await db.responses
        .where('survey_id')
        .equals(surveyId)
        .and(
          (r) => r.survey_version === surveyVersion && r.status === 'draft'
        )
        .toArray();

      const existingDraft = existingDrafts[0];
      const responseId = existingDraft?.response_id || generateResponseId();
      const startedAt = existingDraft?.started_at || new Date().toISOString();
      const answers = existingDraft
        ? JSON.parse(existingDraft.answers_json || '{}')
        : {};

      set({
        surveyId,
        version,
        responseId,
        currentQuestionIndex: 0,
        answers,
        files: {},
        location:
          existingDraft?.latitude !== undefined &&
          existingDraft?.longitude !== undefined
            ? {
                latitude: existingDraft.latitude,
                longitude: existingDraft.longitude,
                accuracy: existingDraft.accuracy || 0,
                captured_at:
                  existingDraft.location_captured_at || new Date().toISOString(),
              }
            : null,
        startedAt,
        isLoading: false,
        isHydrated: true,
      });
    } catch (error) {
      console.error('Failed to initialize survey fill:', error);
      set({
        ...initialState,
        error: 'Error al inicializar la encuesta',
        isLoading: false,
        isHydrated: true,
      });
    }
  },

  saveDraft: async () => {
    const state = get();
    if (!state.surveyId || !state.version || !state.responseId) return;

    const user = getCurrentUser();
    if (!user) return;

    try {
      const response = buildDraftResponse(state, user);

      const existing = await db.responses
        .where('response_id')
        .equals(state.responseId)
        .first();

      if (existing?.id !== undefined) {
        response.id = existing.id;
      }

      await db.responses.put(response);
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  },

  setAnswer: (questionKey, value) => {
    set((state) => ({
      answers: { ...state.answers, [questionKey]: value },
    }));
  },

  setFiles: (questionKey, files) => {
    set((state) => ({
      files: { ...state.files, [questionKey]: files },
    }));
  },

  removeFile: (questionKey, fileId) => {
    set((state) => {
      const sectionFiles = state.files[questionKey] || [];
      const updated = sectionFiles.filter((f) => f.id !== fileId);
      return {
        files: { ...state.files, [questionKey]: updated },
      };
    });
  },

  setLocation: (location) => {
    set({ location });
  },

  getFillableQuestions: () => {
    const { version, answers } = get();
    return buildFillableQuestions(version, answers);
  },

  getCurrentQuestionEntry: () => {
    const { currentQuestionIndex } = get();
    const fillable = get().getFillableQuestions();
    if (fillable.length === 0) return null;
    const boundedIndex = Math.max(
      0,
      Math.min(currentQuestionIndex, fillable.length - 1)
    );
    return fillable[boundedIndex] ?? null;
  },

  nextQuestion: () => {
    const fillable = get().getFillableQuestions();
    const { currentQuestionIndex } = get();
    if (currentQuestionIndex < fillable.length - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },

  prevQuestion: () => {
    set((state) => ({
      currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1),
    }));
  },

  goToQuestion: (index) => {
    const fillable = get().getFillableQuestions();
    set({
      currentQuestionIndex: Math.max(0, Math.min(index, fillable.length - 1)),
    });
  },

  goToSection: (sectionIndex) => {
    const fillable = get().getFillableQuestions();
    const targetIndex = fillable.findIndex(
      (entry) => entry.sectionIndex === sectionIndex
    );
    if (targetIndex >= 0) {
      set({ currentQuestionIndex: targetIndex });
    }
  },

  reset: () => {
    set({ ...initialState, isHydrated: true });
  },

  getVisibleQuestions: (section) => {
    const { answers } = get();
    return (
      section.questions?.filter(
        (q) =>
          isFillableQuestion(q) && isRelevant(q.relevance_expression, answers)
      ) || []
    );
  },

  getProgress: () => {
    const fillable = get().getFillableQuestions();
    const { currentQuestionIndex } = get();
    if (fillable.length === 0) return 0;
    const boundedIndex = Math.max(
      0,
      Math.min(currentQuestionIndex, fillable.length - 1)
    );
    return ((boundedIndex + 1) / fillable.length) * 100;
  },
}));
