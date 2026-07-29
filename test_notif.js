const fs = require('fs');
const env = fs.readFileSync('c:/it-helpdesk/.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

fetch(`${url}/rest/v1/notifications?select=id&limit=1`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`
  }
})
.then(res => res.json().then(data => ({status: res.status, data})))
.then(({status, data}) => {
  console.log('Status:', status);
  console.log('Data:', data);
})
.catch(console.error);
