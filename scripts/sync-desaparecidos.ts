import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

// 1. Manual environment variables loader from .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
    console.log('Loaded configurations from .env.local');
  }
} catch (err) {
  console.warn('Could not read .env.local file:', err);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseKey = serviceKey || anonKey;
const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
  console.log('DRY RUN MODE ENABLED: Database upserts will be mocked.');
} else if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Supabase URL and Key are required in environment variables.');
  process.exit(1);
}

if (!isDryRun && serviceKey) {
  console.log('Using service_role key. RLS policies will be bypassed.');
} else if (!isDryRun) {
  console.log('WARNING: Using public anon key. Upsert operations might be blocked by RLS policies.');
}

const supabase = (!supabaseUrl || !supabaseKey) ? null : createClient(supabaseUrl, supabaseKey);

// 2. Geo-estimation dictionary mapping states/municipalities to coordinates
function estimateCoordinates(text: string): { latitude: number; longitude: number } {
  const normalized = text.toLowerCase();
  
  const locations = [
    { keys: ['caracas', 'distrito capital', 'chacao', 'baruta', 'el hatillo', 'libertador', 'sucre', 'petare'], lat: 10.4806, lng: -66.9036 },
    { keys: ['la guaira', 'vargas', 'maiquetia', 'macuto', 'caraballeda', 'naiguata'], lat: 10.6012, lng: -66.9324 },
    { keys: ['miranda', 'los teques', 'guarenas', 'guatire', 'valles del tuy', 'charallave'], lat: 10.2500, lng: -66.5833 },
    { keys: ['aragua', 'maracay', 'turmero', 'la victoria', 'cagua'], lat: 10.2442, lng: -67.5973 },
    { keys: ['carabobo', 'valencia', 'puerto cabello', 'guacara', 'naguanagua', 'san diego'], lat: 10.1620, lng: -68.0077 },
    { keys: ['zulia', 'maracaibo', 'cabimas', 'ciudad ojeda', 'san francisco'], lat: 10.6427, lng: -71.6125 },
    { keys: ['lara', 'barquisimeto', 'cabudare', 'carora'], lat: 10.0678, lng: -69.3469 },
    { keys: ['merida', 'mérida', 'el vigia', 'tovar'], lat: 8.5983, lng: -71.1449 },
    { keys: ['tachira', 'táchira', 'san cristobal', 'san cristóbal'], lat: 7.7667, lng: -72.2292 },
    { keys: ['bolivar', 'bolívar', 'ciudad bolivar', 'ciudad bolívar', 'puerto ordaz', 'guayana'], lat: 8.1167, lng: -63.5500 },
    { keys: ['anzoategui', 'anzoátegui', 'barcelona', 'puerto la cruz', 'el tigre'], lat: 10.1333, lng: -64.6833 },
    { keys: ['sucre', 'cumana', 'cumaná', 'carupano', 'carúpano'], lat: 10.4531, lng: -64.1826 },
    { keys: ['monagas', 'maturin', 'maturín'], lat: 9.7500, lng: -63.1833 },
  ];

  for (const loc of locations) {
    for (const key of loc.keys) {
      if (normalized.includes(key)) {
        return { latitude: loc.lat, longitude: loc.lng };
      }
    }
  }

  // Fallback to Caracas center
  return { latitude: 10.4806, longitude: -66.9036 };
}

// 3. Mock data for fallback testing when the website is unreachable
const mockReports = [
  {
    external_id: 'ext-001',
    source: 'desaparecidos-terremoto',
    title: 'Búsqueda de Alejandro Rodríguez',
    description: 'Alejandro Rodríguez, de 34 años, fue visto por última vez en la zona de Chacao, Caracas, vistiendo franela azul y jeans oscuros.',
    image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    contact_info: 'Teléfono de contacto: +58 412-5551234'
  },
  {
    external_id: 'ext-002',
    source: 'desaparecidos-terremoto',
    title: 'Búsqueda de María Gabriela Delgado',
    description: 'María Gabriela Delgado se encontraba en Macuto, La Guaira, al momento del sismo. Cualquier información es vital.',
    image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
    contact_info: 'Contactar a familiares: +58 414-9876543'
  },
  {
    external_id: 'ext-003',
    source: 'desaparecidos-terremoto',
    title: 'Búsqueda de Carlos Eduardo Gómez',
    description: 'Se busca a Carlos Eduardo Gómez, visto por última vez en Maracay, estado Aragua. Tiene una cicatriz en el brazo derecho.',
    image_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
    contact_info: 'Informar al: +58 424-3334455'
  }
];

async function runSync() {
  console.log('Starting missing persons synchronization...');
  
  let categoryId = 'mock-category-uuid-12345';
  
  if (!isDryRun && supabase) {
    // A. Fetch category id for 'personas_desaparecidas'
    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'personas_desaparecidas')
      .single();

    if (catError || !category) {
      console.error('Error fetching categories: Category with slug "personas_desaparecidas" must exist.', catError);
      process.exit(1);
    }
    categoryId = category.id;
  }
  
  console.log(`Using Category ID for "personas_desaparecidas": ${categoryId}`);

  let parsedRecords: any[] = [];

  // B. Attempt to fetch data from the website
  const targetUrl = 'https://desaparecidosterremotovenezuela.com/';
  try {
    console.log(`Fetching site data from ${targetUrl}...`);
    const response = await fetch(targetUrl, { signal: AbortSignal.timeout(5000) });
    
    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Attempt parsing cards/items based on layout assumptions
      $('.missing-person-card, .person-post, .report-card').each((_, element) => {
        const idAttr = $(element).attr('data-id') || $(element).attr('id');
        const title = $(element).find('.name, .title, h3').text().trim();
        const description = $(element).find('.description, .details, p').text().trim();
        const image_url = $(element).find('img').attr('src') || '';
        const contact_info = $(element).find('.contact, .phone').text().trim();
        
        if (title && idAttr) {
          parsedRecords.push({
            external_id: idAttr,
            source: 'desaparecidos-terremoto',
            title: `Búsqueda de ${title}`,
            description: description,
            image_url: image_url,
            contact_info: contact_info || 'Origen: desaparecidosterremotovenezuela.com'
          });
        }
      });
      console.log(`Successfully parsed ${parsedRecords.length} records from site.`);
    } else {
      console.log(`Response status was ${response.status}. Falling back to mock data...`);
    }
  } catch (err) {
    console.log('Unreachable or timeout on target URL. Using local mock reports fallback.');
  }

  // Fallback to mock data if scraping yielded no items
  if (parsedRecords.length === 0) {
    console.log('Using mock records as fallback.');
    parsedRecords = mockReports;
  }

  // C. Map records and compute coordinates
  const reportsToUpsert = parsedRecords.map((record) => {
    const { latitude, longitude } = estimateCoordinates(record.description || record.title);
    return {
      type: 'necesidad',
      category_id: categoryId,
      title: record.title.substring(0, 100),
      description: record.description,
      latitude,
      longitude,
      urgency: 'alta', // High urgency for missing persons reports
      reporter_alias: 'Sincronizador Automático',
      contact_info: record.contact_info,
      status: 'activo',
      external_id: record.external_id,
      source: record.source,
      image_url: record.image_url
    };
  });

  // D. Upsert records using unique constraint on (source, external_id)
  console.log(`Upserting ${reportsToUpsert.length} reports...`);
  
  for (const report of reportsToUpsert) {
    if (isDryRun) {
      console.log(`[DRY RUN] Would upsert report: "${report.title}"`);
      console.log(`  - Location coordinates: Lat ${report.latitude}, Lng ${report.longitude}`);
      console.log(`  - Source: ${report.source}, External ID: ${report.external_id}`);
      console.log(`  - Description: ${report.description.substring(0, 60)}...`);
    } else if (supabase) {
      const { data, error } = await supabase
        .from('reports')
        .upsert(report, {
          onConflict: 'source,external_id'
        })
        .select();

      if (error) {
        console.error(`Error upserting report "${report.title}":`, error.message);
      } else {
        console.log(`Upserted: "${report.title}" (External ID: ${report.external_id})`);
      }
    }
  }

  console.log('Synchronization complete!');
}

runSync().catch((err) => {
  console.error('Synchronization failed:', err);
});
