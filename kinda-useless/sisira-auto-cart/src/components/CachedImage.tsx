// components/CachedImage.tsx

import React, { useState, useEffect } from 'react';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  loadingComponent?: React.ReactNode;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  src,
  alt,
  fallback = '/logo.png',
  loadingComponent = null,
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!src) return;

    // Check if image is in cache
    const checkCache = async (): Promise<void> => {
      if ('caches' in window) {
        try {
          const cache: Cache = await caches.open('image-cache-v1');
          const cachedResponse: Response | undefined = await cache.match(`${src}?cache=true`);
          
          if (cachedResponse) {
            // Image is in cache, use blob URL for immediate display
            const blob: Blob = await cachedResponse.blob();
            setImgSrc(URL.createObjectURL(blob));
            setLoading(false);
          } else {
            // Image not in cache, use original source with cache flag
            setImgSrc(`${src}?cache=true`);
          }
        } catch (error) {
          // Fallback to normal loading if cache access fails
          setImgSrc(src);
        }
      } else {
        // Service workers not supported, use original source
        setImgSrc(src);
      }
    };

    checkCache();
  }, [src]);

  const handleLoad = (): void => {
    setLoading(false);
  };

  const handleError = (): void => {
    setImgSrc(fallback);
    setLoading(false);
  };

  return (
    <>
      {loading && loadingComponent}
      <img
        src={imgSrc}
        alt={alt || 'Image'}
        onLoad={handleLoad}
        onError={handleError}
        style={{ display: loading ? 'none' : 'block' }}
        {...props}
      />
    </>
  );
};

// Helper utility function to clear image cache if needed
export const clearImageCache = async (): Promise<string> => {
  if ('serviceWorker' in navigator) {
    const registrations: readonly ServiceWorkerRegistration[] = await navigator.serviceWorker.getRegistrations();
    const sw = registrations.find(r => r.active);
    
    if (sw && sw.active) {
      return new Promise<string>((resolve) => {
        const messageChannel: MessageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event: MessageEvent) => {
          resolve(event.data.status);
        };
        
        sw.active.postMessage(
          { action: 'clearImageCache' },
          [messageChannel.port2]
        );
      });
    }
  }
  
  return Promise.resolve('Service worker not available');
};