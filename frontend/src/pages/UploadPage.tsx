import { useState, useRef, useCallback } from 'react';
import { uploadApi, UploadResult } from '../services/api';
import './UploadPage.css';

interface FileWithSize extends File {
  size: number;
}

interface UploadResponse {
  files: UploadResult[];
  totalTotalCount: number;
  totalNewCount: number;
  totalDuplicateCount: number;
  totalCategorizedCount: number;
}

function UploadPage() {
  const [files, setFiles] = useState<FileWithSize[]>([]);
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [csvMapping, setCsvMapping] = useState({
    date: 'Date',
    amount: 'Amount',
    description: 'Description',
    type: '',
    external_id: '',
  });

  const hasCSV = files.some((f) => f.name.toLowerCase().endsWith('.csv'));

  const CSV_PRESETS = {
    nubank: {
      date: 'Data',
      amount: 'Valor',
      description: 'Descri\u00e7\u00e3o',
      type: '',
      external_id: 'Identificador',
    },
    generic: {
      date: 'Date',
      amount: 'Amount',
      description: 'Description',
      type: 'Type',
      external_id: '',
    },
  } as const satisfies Record<string, typeof csvMapping>;

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;

    const validFiles: FileWithSize[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const f = newFiles[i];
      if (!f) continue;
      const ext = f.name.toLowerCase().split('.').pop();
      if (ext === 'ofx' || ext === 'csv') {
        validFiles.push(f as FileWithSize);
      }
    }

    if (validFiles.length === 0) {
      setError('Unsupported file type. Please upload .ofx or .csv files.');
      return;
    }

    setFiles((prev) => [...prev, ...validFiles]);
    setResult(null);
    setError(null);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragover(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const mapping = hasCSV
        ? {
            date: csvMapping.date,
            amount: csvMapping.amount,
            description: csvMapping.description,
            ...(csvMapping.type ? { type: csvMapping.type } : {}),
            ...(csvMapping.external_id ? { external_id: csvMapping.external_id } : {}),
          }
        : undefined;

      const res = await uploadApi.uploadFiles(files, mapping);
      setResult(res);
      setFiles([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-page">
      <h2>Upload Transactions</h2>

      <div
        className={`upload-zone ${dragover ? 'dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <p>Drag & drop your bank files here, or click to browse</p>
        <span className="file-types">Supports .ofx and .csv files</span>
        <input
          ref={inputRef}
          type="file"
          accept=".ofx,.csv"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="selected-files">
          {files.map((f, i) => (
            <div key={i} className="selected-file">
              <span className="filename">{f.name}</span>
              <span>({(f.size / 1024).toFixed(1)} KB)</span>
              <button className="btn-remove" onClick={() => removeFile(i)} type="button">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {hasCSV && (
        <div className="csv-mapping card">
          <h3>CSV Column Mapping</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            Enter the column header names from your CSV files, or pick a preset
          </p>
          <div className="preset-bar">
            <label>Preset:</label>
            <button
              className="btn-secondary"
              onClick={() => setCsvMapping({ ...CSV_PRESETS.nubank })}
            >
              Nubank
            </button>
            <button
              className="btn-secondary"
              onClick={() => setCsvMapping({ ...CSV_PRESETS.generic })}
            >
              Generic
            </button>
          </div>
          <div className="mapping-grid">
            <div className="mapping-field">
              <label>Date Column *</label>
              <input
                value={csvMapping.date}
                onChange={(e) => setCsvMapping({ ...csvMapping, date: e.target.value })}
              />
            </div>
            <div className="mapping-field">
              <label>Amount Column *</label>
              <input
                value={csvMapping.amount}
                onChange={(e) => setCsvMapping({ ...csvMapping, amount: e.target.value })}
              />
            </div>
            <div className="mapping-field">
              <label>Description Column *</label>
              <input
                value={csvMapping.description}
                onChange={(e) =>
                  setCsvMapping({
                    ...csvMapping,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div className="mapping-field">
              <label>Type Column (optional)</label>
              <input
                value={csvMapping.type}
                onChange={(e) => setCsvMapping({ ...csvMapping, type: e.target.value })}
                placeholder="e.g. Type"
              />
            </div>
            <div className="mapping-field">
              <label>External ID Column (optional)</label>
              <input
                value={csvMapping.external_id}
                onChange={(e) =>
                  setCsvMapping({ ...csvMapping, external_id: e.target.value })
                }
                placeholder="e.g. Identificador"
              />
            </div>
          </div>
        </div>
      )}

      <div className="upload-actions">
        <button
          className="btn-primary"
          disabled={files.length === 0 || uploading}
          onClick={handleUpload}
        >
          {uploading
            ? 'Uploading...'
            : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
        </button>
        {files.length > 0 && (
          <button
            className="btn-secondary"
            onClick={() => {
              setFiles([]);
              setResult(null);
              setError(null);
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {error && <div className="upload-error">{error}</div>}

      {result && (
        <div className="upload-result">
          <h3>Import Successful!</h3>
          <div className="stats">
            <div className="stat">
              <div className="value">{result.totalTotalCount}</div>
              <div className="label">Total Parsed</div>
            </div>
            <div className="stat">
              <div className="value">{result.totalNewCount}</div>
              <div className="label">New Imported</div>
            </div>
            <div className="stat">
              <div className="value">{result.totalDuplicateCount}</div>
              <div className="label">Duplicates Skipped</div>
            </div>
            <div className="stat">
              <div className="value">{result.totalCategorizedCount}</div>
              <div className="label">Auto-Categorized</div>
            </div>
          </div>
          {result.files.length > 1 && (
            <div className="file-breakdown">
              <h4>Per-file breakdown:</h4>
              <ul>
                {result.files.map((f, i) => (
                  <li key={i}>
                    <strong>{f.filename}</strong>: {f.newCount} new, {f.duplicateCount}{' '}
                    duplicate
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UploadPage;
