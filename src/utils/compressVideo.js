const VIDEO_BITRATE = 2_000_000; // 2 Mbps — good quality for product demos
const MAX_SIZE_MB = 150;

/**
 * Compresses a video file using MediaRecorder (Chrome/Firefox only).
 * Safari does not support captureStream() — returns the original file there.
 * onProgress(0–1) is called periodically during re-encoding.
 *
 * Returns { file, warning } where warning is a string or null.
 */
const compressVideo = (file, onProgress) => {
  const mb = file.size / (1024 * 1024);

  // Hard reject — too large even for upload; caller should throw this
  if (mb > MAX_SIZE_MB) {
    return Promise.resolve({
      file,
      warning: `Video is ${mb.toFixed(0)} MB — please compress it below ${MAX_SIZE_MB} MB before uploading (e.g. using HandBrake).`,
      hardReject: true,
    });
  }

  // Check MediaRecorder + captureStream support
  const canCompress =
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLVideoElement !== "undefined" &&
    "captureStream" in HTMLVideoElement.prototype;

  if (!canCompress) {
    // Safari or unsupported — soft warning, still allow upload
    const warning =
      mb > 50
        ? `Video is ${mb.toFixed(0)} MB. Your browser does not support in-browser compression. Consider pre-compressing with HandBrake before uploading.`
        : null;
    return Promise.resolve({ file, warning, hardReject: false });
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    // Must be in DOM for captureStream to work in some browsers
    video.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px";
    document.body.appendChild(video);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      document.body.removeChild(video);
    };

    video.onerror = () => {
      cleanup();
      resolve({ file, warning: null });
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const stream = video.captureStream();

      // Pick the best supported codec
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm;codecs=vp8";

      let recorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: VIDEO_BITRATE,
        });
      } catch {
        cleanup();
        resolve({ file, warning: null });
        return;
      }

      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunks, { type: mimeType });
        // Only use the compressed version if it is actually smaller
        if (blob.size >= file.size) {
          resolve({ file, warning: null });
          return;
        }
        const outName = file.name.replace(/\.[^.]+$/, ".webm");
        resolve({
          file: new File([blob], outName, { type: mimeType }),
          warning: null,
        });
      };

      // Progress reporting via currentTime
      if (onProgress) {
        video.ontimeupdate = () => {
          if (duration > 0) onProgress(video.currentTime / duration);
        };
      }

      recorder.start(200); // collect data every 200 ms
      video.play().catch(() => {
        recorder.stop();
      });

      video.onended = () => recorder.stop();
    };
  });
};

export default compressVideo;
