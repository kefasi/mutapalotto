const CACHE_NAME = 'mutapa-lottery-v1';
const API_CACHE_NAME = 'mutapa-lottery-api-v1';

// Assets to cache for offline functionality
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/user/profile',
  '/api/draws/latest',
  '/api/draws/upcoming',
  '/api/tickets/my-tickets'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets and navigation
  event.respondWith(handleStaticRequest(request));
});

// Handle API requests with cache-first strategy for reads, network-first for writes
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const isReadRequest = request.method === 'GET';
  const isWriteRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);

  try {
    if (isReadRequest) {
      // Cache-first strategy for GET requests
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        // Try to update cache in background
        updateCacheInBackground(request);
        return cachedResponse;
      }
    }

    // Network-first for write requests or cache miss
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && isReadRequest) {
      // Cache successful GET responses
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network request failed:', error);
    
    if (isReadRequest) {
      // Return cached response if available
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Return offline response for failed requests
    return createOfflineResponse(request);
  }
}

// Handle static asset requests with cache-first strategy
async function handleStaticRequest(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Static request failed:', error);
    
    // For navigation requests, return cached index.html
    if (request.mode === 'navigate') {
      const cachedIndex = await caches.match('/index.html');
      if (cachedIndex) {
        return cachedIndex;
      }
    }
    
    // Return generic offline response
    return new Response('Offline', { status: 503 });
  }
}

// Update cache in background for fresh data
async function updateCacheInBackground(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
  } catch (error) {
    console.log('Background cache update failed:', error);
  }
}

// Create appropriate offline response based on request
function createOfflineResponse(request) {
  const url = new URL(request.url);
  
  if (url.pathname.startsWith('/api/user/profile')) {
    return new Response(JSON.stringify({ 
      error: 'Offline', 
      message: 'Unable to fetch user profile while offline' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (url.pathname.startsWith('/api/draws/')) {
    return new Response(JSON.stringify({ 
      error: 'Offline', 
      message: 'Unable to fetch draw information while offline' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (url.pathname.startsWith('/api/tickets/')) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ 
    error: 'Offline', 
    message: 'This feature is not available offline' 
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'ticket-purchase') {
    event.waitUntil(syncTicketPurchases());
  }
  
  if (event.tag === 'funds-deposit') {
    event.waitUntil(syncFundsDeposits());
  }
});

// Sync pending ticket purchases when back online
async function syncTicketPurchases() {
  try {
    // Get pending purchases from IndexedDB or localStorage
    const pendingPurchases = JSON.parse(localStorage.getItem('pendingTicketPurchases') || '[]');
    
    for (const purchase of pendingPurchases) {
      try {
        await fetch('/api/tickets/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(purchase)
        });
        
        // Remove successful purchase from pending list
        const updatedPending = pendingPurchases.filter(p => p.id !== purchase.id);
        localStorage.setItem('pendingTicketPurchases', JSON.stringify(updatedPending));
        
      } catch (error) {
        console.log('Failed to sync ticket purchase:', error);
      }
    }
  } catch (error) {
    console.log('Error syncing ticket purchases:', error);
  }
}

// Sync pending fund deposits when back online
async function syncFundsDeposits() {
  try {
    const pendingDeposits = JSON.parse(localStorage.getItem('pendingFundsDeposits') || '[]');
    
    for (const deposit of pendingDeposits) {
      try {
        await fetch('/api/user/add-funds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deposit)
        });
        
        // Remove successful deposit from pending list
        const updatedPending = pendingDeposits.filter(d => d.id !== deposit.id);
        localStorage.setItem('pendingFundsDeposits', JSON.stringify(updatedPending));
        
      } catch (error) {
        console.log('Failed to sync funds deposit:', error);
      }
    }
  } catch (error) {
    console.log('Error syncing funds deposits:', error);
  }
}

// Handle push notifications for draw results
self.addEventListener('push', (event) => {
  console.log('Push notification received');
  
  const options = {
    body: 'Check the latest lottery results!',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    data: {
      url: '/results'
    },
    actions: [
      {
        action: 'view',
        title: 'View Results'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      options.title = payload.title || 'Mutapa Lottery';
      options.body = payload.body || options.body;
      if (payload.url) {
        options.data.url = payload.url;
      }
    } catch (error) {
      console.log('Error parsing push payload:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification('Mutapa Lottery', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    const url = event.notification.data?.url || '/';
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Focus existing window if available
          for (const client of clientList) {
            if (client.url.includes(url) && 'focus' in client) {
              return client.focus();
            }
          }
          
          // Open new window if no existing window
          if (clients.openWindow) {
            return clients.openWindow(url);
          }
        })
    );
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_TICKET_OFFLINE') {
    // Store ticket for offline viewing
    const ticket = event.data.ticket;
    const offlineTickets = JSON.parse(localStorage.getItem('offlineTickets') || '[]');
    offlineTickets.push(ticket);
    localStorage.setItem('offlineTickets', JSON.stringify(offlineTickets));
  }
});
