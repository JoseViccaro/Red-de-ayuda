'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';

// Carga el mapa de forma dinámica desactivando SSR
const DynamicMap = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-500">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-2"></div>
      <p className="text-sm font-medium">Cargando mapa interactivo...</p>
    </div>
  ),
});

export default function MapLoader(props: ComponentProps<typeof DynamicMap>) {
  return <DynamicMap {...props} />;
}
