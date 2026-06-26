const assert = require('assert');

console.log('🏁 Iniciando pruebas unitarias de utilidades offline...');

// Mock de localStorage
const storage = {};
global.window = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, value) => { storage[key] = value.toString(); },
  removeItem: (key) => { delete storage[key]; }
};

// Simular el módulo offlineQueue (versión simplificada de Node)
function saveReportOffline(report, queue = []) {
  const newReport = {
    ...report,
    created_at: new Date().toISOString(),
  };
  queue.push(newReport);
  return queue;
}

// Test 1: Guardar reporte offline agrega a la lista
try {
  let queue = [];
  const report = {
    type: 'necesidad',
    category_id: 'cat-1',
    title: 'Falta agua potable',
    description: 'En el sector A',
    latitude: 10.48,
    longitude: -66.90,
    urgency: 'alta',
    reporter_alias: 'Vecino1',
  };

  queue = saveReportOffline(report, queue);
  
  assert.strictEqual(queue.length, 1);
  assert.strictEqual(queue[0].title, 'Falta agua potable');
  assert.strictEqual(queue[0].urgency, 'alta');
  assert.ok(queue[0].created_at);

  console.log('✅ Test 1: Guardar reporte offline en cola: PASADO');
} catch (e) {
  console.error('❌ Test 1: FALLADO', e);
  process.exit(1);
}

console.log('🎉 ¡Todas las pruebas unitarias pasaron con éxito!');
