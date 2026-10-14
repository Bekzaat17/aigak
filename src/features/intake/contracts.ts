import type { FormEvent, RefObject } from 'react';
import type { AnalysisLevel, Lang } from '../../../shared/types';
import type { DrawerSection } from '../navigation/contracts.ts';
export type SourceMode = 'url' | 'file' | 'text';
export interface IntakeScreenProps {
  lang: Lang;
  mode: SourceMode;
  setMode: (mode: SourceMode) => void;
  url: string;
  setUrl: (url: string) => void;
  text: string;
  setText: (text: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  busy: boolean;
  ai: boolean;
  analysisLevel: AnalysisLevel;
  setAnalysisLevel: (level: AnalysisLevel) => void;
  setDrawer: (section: DrawerSection | null) => void;
  templates: { id: string; name: string }[];
  templateId: string;
  setTemplateId: (id: string) => void;
  drag: boolean;
  setDrag: (drag: boolean) => void;
  uploadRef: RefObject<HTMLInputElement | null>;
  openDemo: () => Promise<void>;
  addFiles: (files: File[]) => void;
  start: (event: FormEvent) => Promise<void>;
}
