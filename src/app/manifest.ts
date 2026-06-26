import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Red de Ayuda Humanitaria',
    short_name: 'RedAyuda',
    description: 'Plataforma comunitaria para reportar recursos y necesidades en situaciones de crisis.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a', // slate-900
    theme_color: '#2563eb', // blue-600
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
