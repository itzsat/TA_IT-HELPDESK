const env = require('fs').readFileSync('c:/it-helpdesk/.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_KEY=(.*)/)[1].trim();
const projectRef = url.replace('https://','').replace('.supabase.co','');

async function tryEndpoint(name, urlPath, body) {
  const res = await fetch(url + urlPath, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  console.log(`[${name}] status=${res.status}`, JSON.stringify(data).substring(0,200));
  return { status: res.status, data };
}

async function main() {
  // Coba beberapa endpoint untuk eksekusi SQL raw
  await tryEndpoint('/rest/v1/rpc/exec', '/rest/v1/rpc/exec', { sql: 'SELECT 1' });
  
  // Coba endpoint lama Supabase
  const res2 = await fetch(url + '/query', {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: 'SELECT 1' })
  });
  console.log('[/query] status:', res2.status, await res2.text());
}

main().catch(console.error);
