import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env
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
  }
} catch (err) {
  console.warn('Could not read .env.local file:', err);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseKey = serviceKey || anonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Supabase URL and Key are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearMocks() {
  console.log('Cleaning mock/simulated records from reports table...');
  const { data, error } = await supabase
    .from('reports')
    .delete()
    .eq('source', 'desaparecidos-terremoto');

  if (error) {
    console.error('Error deleting mock reports:', error.message);
  } else {
    console.log('Successfully cleared all mock reports from database!');
  }
}

clearMocks();
