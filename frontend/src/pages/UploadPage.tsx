import { useState, useRef, useCallback } from 'react';
import { uploadApi } from '../services/api';
import './UploadPage.css';

interface UploadResult {
  filename: string;
  totalCount: number;
  newCount: number;
  duplicateCount: number;
  categorizedCount: number;
}

function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragover, setDragover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // CSV mapping state
  const [csvMapping, setCsvMapping] = useState({
    date: 'Date',
    amount: 'Amount',
    description: 'Description',
    type: '',
    external_id: '',
  });

  const isCSV = file?.name.toLowerCase().endsWith('.csv');

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

  const handleFile = useCallback((f: File) => {
    const ext = f.name.toLowerCase().split('.').pop();
    if (ext !== 'ofx' && ext !== 'csv') {
      setError('Unsupported file type. Please upload .ofx or .csv files.');
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragover(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const mapping = isCSV
        ? {
            date: csvMapping.date,
            amount: csvMapping.amount,
            description: csvMapping.description,
            ...(csvMapping.type ? { type: csvMapping.type } : {}),
            ...(csvMapping.external_id
              ? { external_id: csvMapping.external_id }
              : {}),
          }
        : undefined;

      const res = await uploadApi.uploadFile(file, mapping);
      setResult(res as unknown as UploadResult);
      setFile(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Upload failed';
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
        <p>Drag & drop your bank file here, or click to browse</p>
        <span className="file-types">Supports .ofx and .csv files</span>
        <input
          ref={inputRef}
          type="file"
          accept=".ofx,.csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {file && (
        <div className="selected-file">
          <span className="filename">{file.name}</span>
          <span>({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
      )}

      {isCSV && (
        <div className="csv-mapping card">
          <h3>CSV Column Mapping</h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            Enter the column header names from your CSV file, or pick a preset
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
                onChange={(e) =>
                  setCsvMapping({ ...csvMapping, date: e.target.value })
                }
              />
            </div>
            <div className="mapping-field">
              <label>Amount Column *</label>
              <input
                value={csvMapping.amount}
                onChange={(e) =>
                  setCsvMapping({ ...csvMapping, amount: e.target.value })
                }
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
                onChange={(e) =>
                  setCsvMapping({ ...csvMapping, type: e.target.value })
                }
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
          disabled={!file || uploading}
          onClick={handleUpload}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        {file && (
          <button
            className="btn-secondary"
            onClick={() => {
              setFile(null);
              setResult(null);
              setError(null);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {error && <div className="upload-error">{error}</div>}

      {result && (
        <div className="upload-result">
          <h3>Import Successful!</h3>
          <div className="stats">
            <div className="stat">
              <div className="value">{result.totalCount}</div>
              <div className="label">Total Parsed</div>
            </div>
            <div className="stat">
              <div className="value">{result.newCount}</div>
              <div className="label">New Imported</div>
            </div>
            <div className="stat">
              <div className="value">{result.duplicateCount}</div>
              <div className="label">Duplicates Skipped</div>
            </div>
            <div className="stat">
              <div className="value">{result.categorizedCount}</div>
              <div className="label">Auto-Categorized</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadPage;
