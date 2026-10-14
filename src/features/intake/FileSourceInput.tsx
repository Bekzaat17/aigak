import type { Lang } from '../../../shared/types';
import { translator } from '../../i18n/translate.ts';
import { Upload, File, X } from 'lucide-react';
import { size } from '../../lib/format.ts';
import type { RefObject } from 'react';
export interface FileSourceInputProps {
  lang: Lang;
  files: File[];
  setFiles: (files: File[]) => void;
  drag: boolean;
  setDrag: (value: boolean) => void;
  uploadRef: RefObject<HTMLInputElement | null>;
  addFiles: (files: File[]) => void;
}
export function FileSourceInput({
  lang,
  files,
  setFiles,
  drag,
  setDrag,
  uploadRef,
  addFiles,
}: FileSourceInputProps) {
  const t = translator(lang);

  return (
    <>
      <input
        ref={uploadRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          addFiles(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />
      <button
        className={`dropzone ${drag ? 'dragging' : ''}`}
        type="button"
        onClick={() => uploadRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        onPaste={(e) => {
          const f = Array.from(e.clipboardData.files);
          if (f.length) {
            e.preventDefault();
            addFiles(f);
          }
        }}
      >
        <span className="upload-icon">
          <Upload size={24} />
        </span>
        <strong>
          {t(
            'Перетащите файлы или выберите на устройстве',
            'Файлдарды сүйреңіз немесе құрылғыдан таңдаңыз',
          )}
        </strong>
        <span>
          {t(
            'PDF, изображения, TXT, HTML · до 5 файлов по 10 МБ',
            'PDF, кескіндер, TXT, HTML · әрқайсысы 10 МБ-қа дейін 5 файл',
          )}
        </span>
      </button>
      {files.length > 0 && (
        <div className="file-list">
          {files.map((f, i) => (
            <div key={i}>
              <File size={17} />
              <span>
                {f.name}
                <small>{size(f.size)}</small>
              </span>
              <button
                type="button"
                aria-label={t('Удалить файл', 'Файлды жою')}
                onClick={() => setFiles(files.filter((_, n) => n !== i))}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
