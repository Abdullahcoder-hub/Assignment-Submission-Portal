import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import JSZip from 'jszip';
import api from '../api/axios';
import { Download, FileText, Loader2 } from 'lucide-react';

type ArchiveEntry = {
  name: string;
  isDirectory: boolean;
};

const getExtension = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
};

const readPptxSlides = async (data: ArrayBuffer): Promise<string[][]> => {
  const zip = await JSZip.loadAsync(data);
  const presentationFile = zip.file('ppt/presentation.xml');
  const relationshipsFile = zip.file('ppt/_rels/presentation.xml.rels');
  if (!presentationFile || !relationshipsFile) {
    throw new Error('This PowerPoint file is missing presentation data.');
  }

  const [presentationXml, relationshipsXml] = await Promise.all([
    presentationFile.async('text'),
    relationshipsFile.async('text'),
  ]);
  const parser = new DOMParser();
  const presentation = parser.parseFromString(presentationXml, 'application/xml');
  const relationships = parser.parseFromString(relationshipsXml, 'application/xml');
  if (presentation.querySelector('parsererror') || relationships.querySelector('parsererror')) {
    throw new Error('The PowerPoint file could not be read.');
  }

  const relationshipMap = new Map<string, string>();
  Array.from(relationships.getElementsByTagNameNS('*', 'Relationship')).forEach((relationship) => {
    const relationshipId = relationship.getAttribute('Id');
    const target = relationship.getAttribute('Target');
    if (relationshipId && target) {
      relationshipMap.set(relationshipId, new URL(target, 'https://preview.invalid/ppt/').pathname.slice(1));
    }
  });

  const slideIds = Array.from(presentation.getElementsByTagNameNS('*', 'sldId'));
  if (slideIds.length === 0) {
    throw new Error('No slides were found in this PowerPoint file.');
  }

  return Promise.all(slideIds.map(async (slideId) => {
    const relationshipId = slideId.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'id',
    );
    const slidePath = relationshipId ? relationshipMap.get(relationshipId) : undefined;
    const slideFile = slidePath ? zip.file(slidePath) : null;
    if (!slideFile) {
      throw new Error('A slide in this PowerPoint file could not be read.');
    }

    const slideXml = parser.parseFromString(await slideFile.async('text'), 'application/xml');
    if (slideXml.querySelector('parsererror')) {
      throw new Error('A slide in this PowerPoint file is invalid.');
    }

    return Array.from(slideXml.getElementsByTagNameNS('*', 'sp'))
      .map((shape) => Array.from(shape.getElementsByTagNameNS('*', 'p'))
        .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS('*', 't'))
          .map((text) => text.textContent || '')
          .join(''))
        .filter(Boolean)
        .join('\n'))
      .filter(Boolean);
  }));
};

export const SubmissionPreview: React.FC = () => {
  const { id = '' } = useParams();
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState('');
  const [contentType, setContentType] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [pptxSlides, setPptxSlides] = useState<string[][]>([]);
  const [archiveEntries, setArchiveEntries] = useState<ArchiveEntry[]>([]);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  const extension = getExtension(fileName);
  const imageExtensions = useMemo(() => new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']), []);
  const isPdf = extension === '.pdf' || contentType === 'application/pdf';
  const isImage = imageExtensions.has(extension) || contentType.startsWith('image/');

  useEffect(() => {
    let cancelled = false;
    const loadFile = async () => {
      try {
        const response = await api.get<ArrayBuffer>(`/submissions/${encodeURIComponent(id)}/view`, {
          responseType: 'arraybuffer',
        });
        if (cancelled) return;

        const encodedFileName = response.headers['x-file-name'];
        const responseType = String(response.headers['content-type'] || '').split(';')[0].toLowerCase();
        setFileName(encodedFileName ? decodeURIComponent(encodedFileName) : `submission${responseType === 'application/pdf' ? '.pdf' : ''}`);
        setContentType(responseType);
        setFileData(response.data);
      } catch (loadError: unknown) {
        if (!cancelled) {
          const status = typeof loadError === 'object' && loadError !== null && 'response' in loadError
            ? (loadError as { response?: { status?: number } }).response?.status
            : undefined;
          setError(status === 401 || status === 403
            ? 'You are not authorized to view this file. Please log in with the correct account.'
            : status === 404
              ? 'The submission file could not be found.'
              : 'The submission file could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadFile();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!fileData || (!isPdf && !isImage)) return;
    const url = URL.createObjectURL(new Blob([fileData], {
      type: contentType || (isPdf ? 'application/pdf' : 'application/octet-stream'),
    }));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [contentType, fileData, isImage, isPdf]);

  useEffect(() => {
    if (!fileData) return;
    let cancelled = false;

    const renderOfficePreview = async () => {
      try {
        if (extension === '.docx' && previewRef.current) {
          const { renderAsync } = await import('docx-preview');
          if (!cancelled && previewRef.current) {
            await renderAsync(fileData, previewRef.current);
          }
        } else if (extension === '.pptx') {
          const slides = await readPptxSlides(fileData);
          if (!cancelled) setPptxSlides(slides);
        } else if (extension === '.zip') {
          const zip = await JSZip.loadAsync(fileData);
          const entries = Object.values(zip.files);
          if (!cancelled) {
            setArchiveTotal(entries.length);
            setArchiveEntries(entries.slice(0, 500).map((entry) => ({
              name: entry.name,
              isDirectory: entry.dir,
            })));
          }
        }
      } catch (previewError) {
        if (!cancelled) {
          setError(previewError instanceof Error ? previewError.message : 'This file could not be previewed.');
        }
      }
    };

    void renderOfficePreview();
    return () => {
      cancelled = true;
    };
  }, [extension, fileData]);

  const downloadOriginal = async () => {
    setDownloading(true);
    try {
      const response = await api.get<ArrayBuffer>(`/submissions/${encodeURIComponent(id)}/view?download=true`, {
        responseType: 'arraybuffer',
      });
      const url = URL.createObjectURL(new Blob([response.data], { type: contentType || 'application/octet-stream' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'submission-file';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError('The original file could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  };
  return (
    <main className="min-h-[70vh] bg-slate-100 px-3 py-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-indigo-600" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-slate-900">{fileName || 'Submission preview'}</h1>
              <p className="text-xs text-slate-500">File preview</p>
            </div>
          </div>
          {fileData && (
            <button
              type="button"
              onClick={() => void downloadOriginal()}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download original
            </button>
          )}
        </header>

        {loading ? (
          <div className="rounded-xl bg-white p-12 text-center text-sm text-slate-600">
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-indigo-600" />
            Loading submission file...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>
        ) : isPdf && previewUrl ? (
          <iframe
            title={`Preview of ${fileName}`}
            src={previewUrl}
            className="h-[80vh] w-full rounded-xl border border-slate-200 bg-white"
          />
        ) : isImage && previewUrl ? (
          <div className="flex min-h-[65vh] items-center justify-center rounded-xl border border-slate-200 bg-white p-4">
            <img
              src={previewUrl}
              alt={fileName}
              className="max-h-[78vh] max-w-full object-contain"
            />
          </div>
        ) : extension === '.docx' ? (
          <div ref={previewRef} className="min-h-[65vh] overflow-auto rounded-xl border border-slate-200 bg-white p-4 sm:p-8" />
        ) : extension === '.pptx' ? (
          <section className="space-y-4">
            <p className="text-xs text-slate-600">PowerPoint text preview</p>
            {pptxSlides.map((paragraphs, index) => (
              <article key={index} className="min-h-48 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-700">Slide {index + 1}</h2>
                {paragraphs.length ? paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex} className="mb-2 whitespace-pre-wrap text-sm text-slate-800">{paragraph}</p>
                )) : <p className="text-xs text-slate-500">No text on this slide.</p>}
              </article>
            ))}
          </section>
        ) : extension === '.zip' ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div className="max-h-[75vh] overflow-auto rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-bold text-slate-800">Archive contents ({archiveTotal})</h2>
              <ul className="space-y-1">
                {archiveEntries.map((entry) => (
                  <li key={entry.name} className="truncate px-2 py-1 text-xs text-slate-700" title={entry.name}>
                    {entry.isDirectory ? '📁' : '📄'} {entry.name}
                  </li>
                ))}
              </ul>
              {archiveTotal > archiveEntries.length && (
                <p className="mt-3 text-xs text-slate-500">Showing the first {archiveEntries.length} entries.</p>
              )}
            </div>
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              ZIP archive preview shows the file and folder list. Download the original to open an item.
            </div>
          </section>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            This file format cannot be rendered in the browser preview. Use “Download original” to open it in a compatible application.
          </div>
        )}
      </div>
    </main>
  );
};
