import { useState, useRef } from "react";
import { API_ENDPOINTS } from "../../config/api";

const fmt = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function S3Test() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(""); // progress text
  const [log, setLog] = useState([]); // step-by-step log
  const [result, setResult] = useState(null); // { url, sizeBefore, sizeAfter }
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const inputRef = useRef(null);

  const addLog = (msg) => setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);

  const reset = () => {
    setFile(null);
    setStatus("");
    setLog([]);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0]; // capture before reset() clears the input
    reset();
    if (f) setFile(f);
  };

  const run = async () => {
    if (!file) return;
    setRunning(true);
    setError("");
    setResult(null);
    setLog([]);
    const sizeBefore = file.size;

    try {
      addLog(`File: ${file.name} (${fmt(sizeBefore)}, ${file.type || "unknown type"})`);

      // Step 1 — get pre-signed URL
      setStatus("Getting S3 upload URL…");
      addLog("Requesting pre-signed S3 URL from server…");

      const token = localStorage.getItem("accessToken");
      const params = new URLSearchParams({ fileName: file.name, contentType: file.type || "video/mp4" });
      const sigRes = await fetch(`${API_ENDPOINTS.products}/s3-video-url?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!sigRes.ok) {
        const { message } = await sigRes.json().catch(() => ({}));
        throw new Error(message || `Server returned ${sigRes.status}`);
      }
      const { uploadUrl, publicUrl } = await sigRes.json();
      addLog(`Got pre-signed URL. Public URL will be:\n${publicUrl}`);

      // Step 2 — PUT to S3
      setStatus("Uploading to S3…");
      addLog("Uploading video to S3…");

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "video/mp4" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`S3 PUT failed — HTTP ${putRes.status}`);

      addLog("Upload successful ✓");
      setStatus("");
      setResult({ url: publicUrl, sizeBefore, sizeAfter: sizeBefore });
    } catch (err) {
      setError(err.message || "Unknown error");
      addLog(`❌ ${err.message}`);
      setStatus("");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">S3 Video Upload Test</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tests the full pipeline: compress → get pre-signed URL → PUT to S3
          </p>
        </div>

        {/* File picker */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Pick a video file</span>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              onChange={handleFile}
              className="mt-2 block w-full text-sm text-gray-500 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-[#800020] file:text-white file:font-semibold file:cursor-pointer"
            />
          </label>

          {file && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
              <span className="font-medium">{file.name}</span>
              <span className="ml-3 text-gray-400">{fmt(file.size)}</span>
              <span className="ml-3 text-gray-400">{file.type || "unknown type"}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={run}
              disabled={!file || running}
              className="px-6 py-2.5 bg-[#800020] text-white text-sm font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#a0152d] transition-colors"
            >
              {running ? status || "Running…" : "Run Upload Test"}
            </button>
            {(file || log.length > 0) && (
              <button
                onClick={reset}
                disabled={running}
                className="px-6 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Live log */}
        {log.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-5 space-y-1.5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Log</p>
            {log.map((line, i) => (
              <p key={i} className="text-xs font-mono text-green-400 whitespace-pre-wrap">{line}</p>
            ))}
            {running && status && (
              <p className="text-xs font-mono text-yellow-400 animate-pulse">{status}</p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-red-700 mb-1">Upload failed</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Success */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-green-600 text-lg">✓</span>
              <p className="text-sm font-bold text-green-700">Upload successful</p>
            </div>

            <div className="bg-white rounded-xl p-3 border border-green-100 text-center w-40">
              <p className="text-xs text-gray-500">File size</p>
              <p className="text-sm font-bold text-gray-800">{fmt(result.sizeBefore)}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Public URL</p>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 underline break-all"
              >
                {result.url}
              </a>
            </div>

            {/* Inline video playback */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Preview</p>
              <video
                src={result.url}
                controls
                className="w-full rounded-xl bg-black max-h-64"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
