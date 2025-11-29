// src/pages/FileUpload.jsx
import React, { useState, useRef } from "react";
import { getAuthToken, apiFetch } from "../lib/api"; // make sure apiFetch handles base URL

// CSV preview parser
function parseCsvPreview(text, maxRows = 8, maxCols = 12) {
  if (!text) return [];
  const rows = [];
  let row = [], cur = "", inQuotes = false, i = 0;

  while (i < text.length && rows.length < maxRows) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cur += '"'; i += 2; continue; }
      inQuotes = !inQuotes; i++; continue;
    }
    if (!inQuotes && (ch === "," || ch === "\t")) { row.push(cur); cur = ""; i++; continue; }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      row.push(cur); cur = "";
      if (!(row.length === 1 && row[0] === "" && rows.length === 0)) rows.push(row.slice(0, maxCols));
      row = [];
      if (ch === "\r" && text[i + 1] === "\n") i += 2; else i++;
      continue;
    }
    cur += ch; i++;
  }
  if ((cur !== "" || row.length > 0) && rows.length < maxRows) { row.push(cur); rows.push(row.slice(0, maxCols)); }
  return rows;
}

export default function FileUpload() {
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null);
  const [dragging, setDragging] = useState(false);

  function handleFileChosen(f) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setStatus({ ok: false, err: "Only .csv files are accepted" });
      setFile(null); setPreview([]); return;
    }
    setFile(f); setStatus(null);
    const reader = new FileReader();
    reader.onload = (ev) => { setPreview(parseCsvPreview(String(ev?.target?.result ?? ""), 10)); };
    reader.readAsText(f.slice(0, 64 * 1024));
  }

  function onFileInputChange(e) { handleFileChosen(e.target.files?.[0]); }
  function onDrop(e) { e.preventDefault(); e.stopPropagation(); setDragging(false); handleFileChosen(e.dataTransfer?.files?.[0]); }
  function onDragOver(e) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; setDragging(true); }
  function onDragLeave(e) { e.preventDefault(); e.stopPropagation(); setDragging(false); }

  function downloadSampleCSV() {
    const sample = [
      ["employee_id", "name", "department", "start_date", "end_date"],
      ["E001", "Alice Johnson", "Finance", "2018-05-10", ""],
      ["E002", "Bob Smith", "Engineering", "2019-03-01", "2023-12-31"],
    ];
    const csv = sample.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "sample_upload.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function upload() {
    if (!file) return alert("Choose a CSV file first");
    setUploading(true); setProgress(0); setStatus(null);

    const token = getAuthToken();
    if (!token) {
      setUploading(false);
      alert("No valid JWT access token found. Make sure you are logged in.");
      return;
    }

    try {
      const text = await file.text(); // read full CSV
      const payload = { csv: text };

      const data = await apiFetch("/proxy/dc/project/", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      setUploading(false); setProgress(100); setStatus({ ok: true, data });
    } catch (err) {
      setUploading(false); setProgress(0);
      setStatus({ ok: false, err: err?.body ?? String(err) });
    }
  }

  function clear() { setFile(null); setPreview([]); setStatus(null); setProgress(0); if (inputRef.current) inputRef.current.value = ""; }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-semibold mb-4">Batch CSV Upload</h2>

      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        className={`w-full rounded-md border-2 p-4 mb-4 transition ${dragging ? "border-green-500 bg-green-50" : "border-dashed border-gray-300 bg-white"}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">Drag & drop a CSV file here, or</div>
            <div className="mt-2 flex items-center gap-2">
              <label className="inline-block px-4 py-2 bg-green-600 text-white rounded cursor-pointer">
                Choose file
                <input ref={inputRef} type="file" accept=".csv" onChange={onFileInputChange} className="hidden" />
              </label>
              <button type="button" className="px-3 py-2 border rounded text-sm" onClick={downloadSampleCSV}>Download sample CSV</button>
              <button type="button" className="px-3 py-2 border rounded text-sm" onClick={() => inputRef.current?.click()}>Browse</button>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {file ? <div><div className="font-medium">{file.name}</div><div className="text-xs">{(file.size / 1024).toFixed(1)} KB</div></div> : <div className="text-xs">No file selected</div>}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-1">Preview (first rows)</div>
          {preview.length > 0 ? (
            <div className="overflow-auto border rounded bg-gray-50">
              <table className="min-w-full text-sm">
                <tbody>
                  {preview.map((r, idx) => (
                    <tr key={idx} className={idx === 0 ? "bg-gray-100 font-medium" : ""}>
                      {r.map((cell, cidx) => (<td key={cidx} className="px-3 py-2 border-r whitespace-pre">{cell}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="text-sm text-gray-400">No preview available</div>}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button type="button" className={`px-4 py-2 rounded ${uploading ? "bg-gray-400 text-white" : "bg-green-600 text-white"} shadow-sm`} onClick={upload} disabled={!file || uploading}>
          {uploading ? `Uploading ${progress}%` : "Upload & Process"}
        </button>
        <button type="button" className="px-4 py-2 border rounded" onClick={clear} disabled={uploading && !file}>Clear</button>
        <div className="text-sm text-gray-500 ml-auto">{status ? (status.ok ? <span className="text-green-600">Upload successful</span> : <span className="text-red-600">Upload failed</span>) : <span>Ready</span>}</div>
      </div>

      {status && (
        <div className="bg-white rounded border p-4">
          {status.ok ? (
            <>
              <div className="flex items-start justify-between mb-2">
                <div><div className="text-sm text-gray-600">Server response</div><div className="text-base font-medium text-green-700 mt-1">Success</div></div>
                <div className="flex items-center gap-2">
                  <button type="button" className="px-3 py-1 border rounded text-sm" onClick={() => { const blob = new Blob([JSON.stringify(status.data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `upload_result_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); }}>Download result</button>
                  <button type="button" className="px-3 py-1 border rounded text-sm" onClick={() => navigator.clipboard?.writeText(JSON.stringify(status.data, null, 2)).then(()=>alert("Copied"))}>Copy JSON</button>
                </div>
              </div>
              <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto" style={{ maxHeight: 300 }}>{JSON.stringify(status.data, null, 2)}</pre>
            </>
          ) : (
            <>
              <div className="text-sm text-red-600 font-medium mb-2">Error</div>
              <div className="text-xs text-gray-700 whitespace-pre-wrap">{String(status.err)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
