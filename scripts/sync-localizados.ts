import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

const supabase = (!supabaseUrl || !supabaseKey) ? null : createClient(supabaseUrl, supabaseKey);

// 2. Geolocation estimation mapping specific to earthquake response centers & hospitals
function estimateCoordinates(lugar: string, direccion: string): { latitude: number; longitude: number } {
  const text = `${lugar} ${direccion}`.toLowerCase();
  
  const locations = [
    // Hospitals & specific places
    { keys: ['perez carreño', 'perez carreno'], lat: 10.4726, lng: -66.9536 },
    { keys: ['playa los cocos', 'los cocos'], lat: 10.6128, lng: -66.8615 },
    { keys: ['campo de golf caribe', 'golf caribe'], lat: 10.6184, lng: -66.8432 },
    { keys: ['clinica santa sofia'], lat: 10.4717, lng: -66.8290 },
    { keys: ['hospital de clinicas caracas'], lat: 10.5050, lng: -66.8988 },
    { keys: ['militar carlos arvelo', 'hospital militar'], lat: 10.5074, lng: -66.9272 },
    { keys: ['j.m. de los rios', 'jm de los rios'], lat: 10.5126, lng: -66.9048 },
    { keys: ['vargas de caracas', 'hospital vargas'], lat: 10.5152, lng: -66.9038 },
    { keys: ['domingo luciani'], lat: 10.4851, lng: -66.8144 },
    { keys: ['universitario de caracas', 'hospital universitario'], lat: 10.4901, lng: -66.8893 },
    { keys: ['clinico universitario'], lat: 10.4901, lng: -66.8893 },
    
    // General locations
    { keys: ['caracas', 'distrito capital', 'chacao', 'baruta', 'el hatillo', 'libertador', 'sucre', 'petare'], lat: 10.4806, lng: -66.9036 },
    { keys: ['la guaira', 'vargas', 'maiquetia', 'maiquetía', 'macuto', 'caraballeda', 'naiguata', 'naiguatá'], lat: 10.6012, lng: -66.9324 },
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
      if (text.includes(key)) {
        return { latitude: loc.lat, longitude: loc.lng };
      }
    }
  }

  // Fallback to Caracas center
  return { latitude: 10.4806, longitude: -66.9036 };
}

function getBigrams(str: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.substring(i, i + 2));
  }
  return bigrams;
}

function diceCoefficient(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;
  
  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);
  
  let intersection = 0;
  for (const val of bigrams1) {
    if (bigrams2.has(val)) {
      intersection++;
    }
  }
  
  return (2 * intersection) / (bigrams1.size + bigrams2.size);
}

async function runSync() {
  console.log('Starting localizados synchronization...');
  
  let categoryId = 'mock-category-uuid-54321';
  
  let existingActiveReports: any[] = [];

  if (!isDryRun && supabase) {
    const { data: category, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', 'personas_encontradas')
      .single();

    if (catError || !category) {
      console.error('Error fetching categories: Category with slug "personas_encontradas" must exist.', catError);
      process.exit(1);
    }
    categoryId = category.id;

    // Fetch existing active reports to match names
    const { data: activeReports, error: reportsError } = await supabase
      .from('reports')
      .select('id, title, category_id, external_id')
      .eq('status', 'activo');
    
    if (!reportsError && activeReports) {
      existingActiveReports = activeReports;
    }
  }
  
  console.log(`Using Category ID for "personas_encontradas": ${categoryId}`);
  console.log(`Loaded ${existingActiveReports.length} existing active reports for deduplication matching.`);

  const baseUrl = 'https://localizadosvenezuela.com';
  let currentPage = 1;
  const limit = 100;
  let totalImported = 0;
  
  // Let's do a safety limit of pages to import per run or fetch all
  // The API reports 890 pages with page_size=5 (totalPages=890).
  // With limit=100, there will be around 45 pages.
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching page ${currentPage}...`);
    try {
      const response = await fetch(`${baseUrl}/api/v1/localizados?page=${currentPage}&limit=${limit}`);
      if (!response.ok) {
        console.error(`Failed to fetch page ${currentPage}. Status: ${response.status}`);
        break;
      }

      const json = await response.json();
      const records = json.data || [];
      const totalPages = json.meta?.totalPages || 1;

      if (records.length === 0) {
        console.log('No more records found.');
        break;
      }

      console.log(`Found ${records.length} records on page ${currentPage}/${totalPages}. Processing...`);

      const reportsToUpsert: any[] = [];

      for (const rec of records) {
        // 1. Fuzzy match deduplication against database and current batch
        const cleanName = rec.nombreCompleto.trim();
        if (!cleanName) continue;

        const isDuplicateInDb = existingActiveReports.some((r) => {
          if (r.external_id === rec.slug) return false; // Let upsert handle same ID update
          
          const cleanTitle = r.title.replace('Búsqueda: ', '').replace('Localizado: ', '').trim();
          const score = diceCoefficient(cleanName, cleanTitle);
          return score > 0.85;
        });

        const isDuplicateInBatch = reportsToUpsert.some((r) => {
          const cleanTitle = r.title.replace('Búsqueda: ', '').replace('Localizado: ', '').trim();
          const score = diceCoefficient(cleanName, cleanTitle);
          return score > 0.85;
        });

        if (isDuplicateInDb || isDuplicateInBatch) {
          console.log(`[DEDUPLICATED] Skipping "${cleanName}" - name is highly similar to an existing active report.`);
          continue;
        }

        const { latitude, longitude } = estimateCoordinates(rec.lugarNombre || '', rec.direccion || '');
        const details = [
          rec.direccion ? `Dirección: ${rec.direccion}` : null,
          rec.lugarNombre ? `Ubicación: ${rec.lugarNombre}` : null,
          rec.observaciones ? `Observaciones: ${rec.observaciones}` : null
        ].filter(Boolean).join('\n');

        reportsToUpsert.push({
          type: 'recurso',
          category_id: categoryId,
          title: `Localizado: ${rec.nombreCompleto}`.substring(0, 100),
          description: details || 'Localizado sin observaciones adicionales.',
          latitude,
          longitude,
          urgency: 'alta',
          reporter_alias: 'Sincronizador Localizados',
          contact_info: `Fuente: localizadosvenezuela.com\nSlug: ${rec.slug}`,
          status: 'activo',
          external_id: rec.slug,
          source: 'localizadosvenezuela.com',
          image_url: null
        });
      }

      if (isDryRun) {
        console.log(`[DRY RUN] Would upsert ${reportsToUpsert.length} records. Showing first one:`);
        if (reportsToUpsert.length > 0) {
          console.log(JSON.stringify(reportsToUpsert[0], null, 2));
        }
      } else if (supabase && reportsToUpsert.length > 0) {
        const { error } = await supabase
          .from('reports')
          .upsert(reportsToUpsert, {
            onConflict: 'source,external_id'
          });

        if (error) {
          console.error(`Error upserting batch for page ${currentPage}:`, error.message);
        } else {
          totalImported += reportsToUpsert.length;
          console.log(`Succeeded batch for page ${currentPage}. Total imported so far: ${totalImported}`);
        }
      }

      if (currentPage >= totalPages) {
        hasMore = false;
      } else {
        currentPage++;
        // Short pause to avoid slamming the API
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Limit dry run to 1 page for safety
      if (isDryRun) {
        hasMore = false;
      }

    } catch (err: any) {
      console.error(`Error processing page ${currentPage}:`, err.message || err);
      break;
    }
  }

  console.log(`Synchronization complete! Total imported: ${totalImported}`);
}

runSync().catch((err) => {
  console.error('Synchronization failed:', err);
});
