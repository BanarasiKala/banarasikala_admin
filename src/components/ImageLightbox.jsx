import { useCallback, useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Full-screen image viewer for ticket attachments.
 *
 * Mirrors the storefront's ImageLightbox. Support looks at these photos to decide a refund
 * or a replacement, so opening them in a new tab meant leaving the thread — and the context
 * of what the customer was describing — behind.
 *
 * Written with Tailwind classes rather than a stylesheet to match the rest of this app.
 *
 * @param {Array<{url: string}>} images  The set the clicked photo belongs to.
 * @param {number} startIndex            Which one was clicked.
 * @param {Function} onClose
 */
export default function ImageLightbox({ images = [], startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const count = images.length;

  const go = useCallback((step) => {
    // Wraps, so the arrows never dead-end on the first or last photo.
    setIndex((current) => (current + step + count) % count);
  }, [count]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
      if (event.key === "ArrowRight" && count > 1) go(1);
      if (event.key === "ArrowLeft" && count > 1) go(-1);
    };
    document.addEventListener("keydown", onKey);
    // The admin shell is a fixed-height flex layout whose content area scrolls; lock it so
    // the thread behind doesn't move under the viewer.
    const viewport = document.getElementById("content-viewport");
    const previousOverflow = viewport?.style.overflow;
    if (viewport) viewport.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      if (viewport) viewport.style.overflow = previousOverflow || "";
    };
  }, [onClose, go, count]);

  if (!count) return null;
  const current = images[Math.min(index, count - 1)];

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center px-4 pt-14 pb-6 bg-[#120804]/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute top-3 right-3 w-10 h-10 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {count > 1 && (
        <>
          {/* stopPropagation: the overlay closes on click, and paging must not also dismiss. */}
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); go(-1); }}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); go(1); }}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      <img
        src={current.url}
        alt={count > 1 ? `Photo ${index + 1} of ${count}` : "Photo"}
        onClick={(event) => event.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg cursor-default"
      />

      {count > 1 && (
        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold tracking-wide">
          {index + 1} / {count}
        </span>
      )}
    </div>
  );
}
