// image-cache-sw.ts - Place this file in your src directory
// You'll need to compile this to JS and place it in your public directory

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'image-cache-v1';
const IMAGE_EXTENSIONS: string[] = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];

// Install event - Pre-cache important assets
self.addEventListener('install', (event: ExtendableEvent) => {
  self.skipWaiting();
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames: string[]) => {
      return Promise.all(
        cacheNames.map((cacheName: string) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Cache images
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);
  
  // Check if the request is for an image
  const isImageRequest: boolean = IMAGE_EXTENSIONS.some(ext => url.pathname.toLowerCase().endsWith(ext)) || 
                        url.search.includes('cache=true');

  if (event.request.method === 'GET' && isImageRequest) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache: Cache) => {
        return cache.match(event.request).then((cachedResponse: Response | undefined) => {
          // Return cached response if available
          if (cachedResponse) {
            return cachedResponse;
          }

          // Otherwise fetch from network, then cache
          return fetch(event.request).then((networkResponse: Response) => {
            // Don't cache error responses
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clone the response since it can only be consumed once
            const responseToCache = networkResponse.clone();
            cache.put(event.request, responseToCache);
            
            return networkResponse;
          });
        });
      })
    );
  }
});

// Handle cache cleanup for storage limits
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.action === 'clearImageCache') {
    caches.delete(CACHE_NAME).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ status: 'Image cache cleared' });
      }
    });
  }
});

// This empty export is needed to make TypeScript treat this as a module
export {};