'use client';

import { useEffect, useState, useRef } from 'react';

// ── Cola de precarga con límite de concurrencia ──
// Máximo 5 requests simultáneas para no saturar la red
type PreloadResult = 'ok' | 'fail';

class ImagePreloadQueue {
  private queue: { src: string; resolve: (r: PreloadResult) => void }[] = [];
  private active = 0;
  private readonly maxConcurrent = 5;

  add(src: string): Promise<PreloadResult> {
    return new Promise((resolve) => {
      this.queue.push({ src, resolve });
      this.process();
    });
  }

  private process() {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.active++;
      const img = new Image();
      img.onload = () => {
        this.active--;
        item.resolve('ok');
        this.process();
      };
      img.onerror = () => {
        this.active--;
        item.resolve('fail');
        this.process();
      };
      img.src = item.src;
    }
  }
}

const preloader = new ImagePreloadQueue();

const verifiedCache = new Map<string, PreloadResult>();

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  fallback?: React.ReactNode;
}

export default function SafeImage({
  src,
  alt,
  className = '',
  containerClassName = '',
  fallback,
}: SafeImageProps) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'fail'>('loading');
  const startedRef = useRef(false);

  useEffect(() => {
    const cached = verifiedCache.get(src);
    if (cached) {
      // No llamar setStatus sincrónicamente — el initializer ya está en loading,
      // y el flush después del mount lo actualizará correctamente.
      // Usamos queueMicrotask para diferirlo y evitar el warning de React 19.
      queueMicrotask(() => {
        // La referencia a setStatus es estable, y mountedRef implícito porque
        // queueMicrotask corre antes del cleanup del effect.
        setStatus(cached);
      });
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    preloader.add(src).then((result) => {
      verifiedCache.set(src, result);
      setStatus(result);
    });
  }, [src]);

  if (status === 'loading') {
    return (
      <div
        className={`${containerClassName} flex items-center justify-center bg-slate-200 dark:bg-slate-800`}
      >
        <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (status === 'fail') {
    return (
      <div
        className={`${containerClassName} flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-400`}
      >
        {fallback || (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        )}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />;
}
