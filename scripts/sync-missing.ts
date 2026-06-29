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

// 2. Geolocation estimation mapping specific to Venezuelan locations
function estimateCoordinates(text: string): { latitude: number; longitude: number } {
  const normalized = text.toLowerCase();
  
  const locations = [
    { keys: ['caracas', 'distrito capital', 'chacao', 'baruta', 'el hatillo', 'libertador', 'sucre', 'petare'], lat: 10.4806, lng: -66.9036 },
    { keys: ['la guaira', 'vargas', 'maiquetia', 'maiquetía', 'macuto', 'caraballeda', 'naiguata', 'naiguatá', 'tanaguarena', 'los corales'], lat: 10.6012, lng: -66.9324 },
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

async function runSync() {
  console.log('Starting missing persons synchronization...');
  
  let categoryId = 'mock-category-uuid-12345';
  
  if (!isDryRun && supabase) {
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

  const apiUrlBase = 'https://api.terremotovenezuela.app';
  let currentPage = 1;
  const limit = 100;
  let totalImported = 0;
  
  // Let's import around 10 pages (~1000 records) to keep database responsive and avoid free-tier overflow
  const maxPagesToSync = 10;
  let hasMore = true;

  const fetchedExternalIds: string[] = [];

  while (hasMore && currentPage <= maxPagesToSync) {
    console.log(`Fetching page ${currentPage} of missing persons...`);
    try {
      const response = await fetch(`${apiUrlBase}/api/missing?page=${currentPage}&pageSize=${limit}`);
      if (!response.ok) {
        console.error(`Failed to fetch page ${currentPage}. Status: ${response.status}`);
        break;
      }

      const json = await response.json();
      const people = json.people || [];
      const totalPages = json.totalPages || 1;

      if (people.length === 0) {
        console.log('No more records found.');
        break;
      }

      console.log(`Found ${people.length} records on page ${currentPage}/${totalPages}. Processing...`);

      people.forEach((p: any) => {
        if (p.id) fetchedExternalIds.push(p.id);
      });

      const reportsToUpsert = people.map((person: any) => {
        const lastSeen = person.lastSeen || '';
        const description = person.description || '';
        const combinedText = `${lastSeen}\n${description}`;
        const { latitude, longitude } = estimateCoordinates(combinedText);
        
        // Construct absolute photo URL if exists
        const image_url = person.photoUrl 
          ? `${apiUrlBase}${person.photoUrl}` 
          : null;

        return {
          type: 'necesidad',
          category_id: categoryId,
          title: `Búsqueda: ${person.name}`.substring(0, 100),
          description: description || 'Sin descripción adicional.',
          latitude,
          longitude,
          urgency: 'alta',
          reporter_alias: 'Sincronizador Desaparecidos',
          contact_info: `Última vez visto: ${lastSeen}\nContacto: ${person.contact || 'No especificado'}\nID Origen: ${person.id}`,
          status: 'activo',
          external_id: person.id,
          source: 'api.terremotovenezuela.app',
          image_url
        };
      });

      if (isDryRun) {
        console.log(`[DRY RUN] Would upsert ${reportsToUpsert.length} records. Showing first one:`);
        console.log(JSON.stringify(reportsToUpsert[0], null, 2));
      } else if (supabase) {
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
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (isDryRun) {
        hasMore = false;
      }

    } catch (err: any) {
      console.error(`Error processing page ${currentPage}:`, err.message || err);
      break;
    }
  }

  // 3. Status resolution: check which reports in our DB are no longer in the active upstream response
  if (!isDryRun && supabase && fetchedExternalIds.length > 0) {
    console.log('Resolving status for reports no longer active on the upstream API...');
    
    const { data: dbReports, error: dbError } = await supabase
      .from('reports')
      .select('external_id')
      .eq('source', 'api.terremotovenezuela.app')
      .eq('status', 'activo');
      
    if (dbError) {
      console.error('Error fetching active reports from DB for resolution:', dbError.message);
    } else if (dbReports) {
      const activeDbIds = dbReports.map(r => r.external_id).filter(Boolean);
      const toResolve = activeDbIds.filter(id => !fetchedExternalIds.includes(id));
      
      console.log(`Found ${toResolve.length} reports in DB that are no longer active in the API.`);
      
      if (toResolve.length > 0) {
        const batchSize = 100;
        let resolvedCount = 0;
        for (let i = 0; i < toResolve.length; i += batchSize) {
          const batch = toResolve.slice(i, i + batchSize);
          const { error: updateError } = await supabase
            .from('reports')
            .update({ status: 'resuelto' })
            .in('external_id', batch)
            .eq('source', 'api.terremotovenezuela.app');
            
          if (updateError) {
            console.error('Error resolving batch of reports:', updateError.message);
          } else {
            resolvedCount += batch.length;
          }
        }
        console.log(`Successfully marked ${resolvedCount} reports as resolved/found!`);
      }
    }
  }

  console.log(`Synchronization complete! Total missing persons imported: ${totalImported}`);
}

runSync().catch((err) => {
  console.error('Synchronization failed:', err);
});
