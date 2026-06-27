'use client';

import { useEffect, useState } from 'react';

export default function PWARegister() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Registrar Service Worker y manejar actualizaciones automáticas
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('Service Worker registrado con éxito:', reg.scope);
            // Comprobar si hay actualizaciones del Service Worker en el servidor cada 60 segundos
            setInterval(() => {
              reg.update();
            }, 60000);
          })
          .catch((err) => console.error('Error al registrar Service Worker:', err));
      });

      // Recargar automáticamente cuando un nuevo Service Worker tome el control (skipWaiting + claim)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // Monitorear estado de conexión
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-600 text-white text-xs font-bold text-center py-2 px-4 w-full z-50 shadow-md flex items-center justify-center gap-1.5 animate-pulse">
      <span>⚠️ Modo Sin Conexión Activo. Los nuevos reportes se guardarán en tu dispositivo hasta que recuperes señal.</span>
    </div>
  );
}
