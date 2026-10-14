import type { FormEvent } from 'react';
import type { AnalysisLevel, Lang } from '../../../shared/types';
import type { DrawerSection } from '../navigation/contracts.ts';
export type SourceMode = 'url' | 'file' | 'text';
export interface IntakeScreenProps {
  lang: Lang;
  url: string;
  setUrl: (url: string) => void;
  busy: boolean;
  ai: boolean;
  analysisLevel: AnalysisLevel;
  setAnalysisLevel: (level: AnalysisLevel) => void;
  setDrawer: (section: DrawerSection | null) => void;
  templates: { id: string; name: string }[];
  templateId: string;
  setTemplateId: (id: string) => void;
  openDemo: () => Promise<void>;
  start: (event: FormEvent) => Promise<void>;
}
