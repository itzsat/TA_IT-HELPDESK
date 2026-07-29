/// <reference path="./env-shims.d.ts" />
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Initialize Supabase clients (URL/keys are injected when the function runs on Supabase)
const requireEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `Missing ${name}. Deploy this function on Supabase or set secrets locally.`,
    );
  }
  return value;
};

const getSupabaseAdmin = () => {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );
};

const getSupabaseClient = () => {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
  );
};

// Middleware to verify authentication
const requireAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'Unauthorized: No token provided' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }

  c.set('user', user);
  await next();
};

// Health check endpoint
app.get("/make-server-688b6236/health", (c: any) => {
  return c.json({ status: "ok" });
});

// ============ NOTIFICATION ENDPOINTS ============

// Kirim email notifikasi ke semua IT Support saat tiket baru dibuat
app.post("/make-server-688b6236/notify-support", requireAuth, async (c: any) => {
  try {
    const { ticketId, description, submittedBy } = await c.req.json();
    const supabase = getSupabaseAdmin();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      return c.json({ error: "RESEND_API_KEY not configured" }, 500);
    }

    // Ambil semua user dengan role 'support'
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;

    const supportUsers = (users || []).filter(
      (u: any) => u.user_metadata?.role === 'support' && u.email
    );

    const results = [];
    for (const supportUser of supportUsers) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "IT Helpdesk <onboarding@resend.dev>",
          to: supportUser.email,
          subject: `[IT Helpdesk] Tiket Baru Masuk: #${ticketId}`,
          html: `<h3>Tiket Baru Masuk</h3><p>Dari: <strong>${submittedBy}</strong></p><p>Keluhan:</p><blockquote>${description?.substring(0, 300) || '-'}</blockquote><p>Silakan login ke sistem IT Helpdesk untuk menangani tiket ini.</p>`
        }),
      });
      const data = await res.json();
      results.push({ email: supportUser.email, success: res.ok, data });
    }

    return c.json({ success: true, notified: results.length, results });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ============ AUTHENTICATION ENDPOINTS ============

// Sign up
app.post("/make-server-688b6236/auth/signup", async (c: any) => {
  try {
    const { email, password, name, role } = await c.req.json();
    
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role: role || 'user' },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ success: true, user: data.user });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: 'Failed to create user' }, 500);
  }
});

// Sign in
app.post("/make-server-688b6236/auth/signin", async (c: any) => {
  try {
    const { email, password } = await c.req.json();
    
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      return c.json({ error: error.message }, 400);
    }

    return c.json({ 
      success: true, 
      session: data.session,
      user: data.user 
    });
  } catch (error) {
    console.error('Sign in error:', error);
    return c.json({ error: 'Failed to sign in' }, 500);
  }
});

// Get session
app.get("/make-server-688b6236/auth/session", requireAuth, async (c: any) => {
  const user = c.get('user');
  return c.json({ user });
});

// Sign out
app.post("/make-server-688b6236/auth/signout", requireAuth, async (c: any) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader!.split(' ')[1];
  
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
  
  return c.json({ success: true });
});

// ============ KNOWLEDGE BASE ENDPOINTS ============

// Initialize knowledge base with default data
const initializeKnowledgeBase = async () => {
  const existingRules = await kv.get('kb_rules');
  if (!existingRules) {
    const defaultRules = [
      // aksess email
      {
        id: 'rule_1',
        conditions: ['cannot_access_email', 'authentication_error'],
        conclusion: 'password_issue',
        confidence: 0.9
      },
      {
        id: 'rule_2',
        conditions: ['password_issue'],
        conclusion: 'reset_password_needed',
        confidence: 1.0
      },
      {
        id: 'rule_3',
        conditions: ['authentication_error'],
        conclusion: 'password_issue',
        confidence: 0.8
      },
      // performa issues
      {
        id: 'rule_4',
        conditions: ['slow_computer', 'high_cpu_usage'],
        conclusion: 'performance_issue',
        confidence: 0.85
      },
      {
        id: 'rule_5',
        conditions: ['slow_computer'],
        conclusion: 'performance_issue',
        confidence: 0.7
      },
      {
        id: 'rule_6',
        conditions: ['performance_issue'],
        conclusion: 'close_background_apps',
        confidence: 0.8
      },
      // printer issues - single symptom rules
      {
        id: 'rule_7',
        conditions: ['cannot_print'],
        conclusion: 'printer_connection_issue',
        confidence: 0.85
      },
      {
        id: 'rule_8',
        conditions: ['printer_offline'],
        conclusion: 'printer_connection_issue',
        confidence: 0.9
      },
      {
        id: 'rule_9',
        conditions: ['printer_connection_issue'],
        conclusion: 'check_printer_connection',
        confidence: 1.0
      },
      // VPN issues
      {
        id: 'rule_10',
        conditions: ['cannot_connect_vpn'],
        conclusion: 'vpn_configuration_issue',
        confidence: 0.8
      },
      {
        id: 'rule_11',
        conditions: ['vpn_timeout'],
        conclusion: 'vpn_configuration_issue',
        confidence: 0.75
      },
      {
        id: 'rule_12',
        conditions: ['vpn_configuration_issue'],
        conclusion: 'reconfigure_vpn_settings',
        confidence: 0.9
      },
      // Software issues
      {
        id: 'rule_13',
        conditions: ['application_crash', 'error_message_shown'],
        conclusion: 'software_bug',
        confidence: 0.7
      },
      {
        id: 'rule_14',
        conditions: ['application_crash'],
        conclusion: 'software_bug',
        confidence: 0.6
      },
      {
        id: 'rule_15',
        conditions: ['software_bug'],
        conclusion: 'reinstall_application',
        confidence: 0.75
      },
      // Network issues
      {
        id: 'rule_16',
        conditions: ['no_internet'],
        conclusion: 'network_connectivity_issue',
        confidence: 0.9
      },
      {
        id: 'rule_17',
        conditions: ['wifi_not_detected'],
        conclusion: 'network_connectivity_issue',
        confidence: 0.85
      },
      {
        id: 'rule_18',
        conditions: ['network_connectivity_issue'],
        conclusion: 'check_network_settings',
        confidence: 0.9
      },
    ];
    await kv.set('kb_rules', defaultRules);

    const defaultSolutions = [
      {
        id: 'sol_1',
        problem: 'reset_password_needed',
        title: 'Password Reset Required',
        steps: [
          'Go to the password reset portal at company.com/reset',
          'Enter your email address',
          'Check your email for the reset link',
          'Create a new strong password (at least 8 characters with letters and numbers)',
          'Try logging in again with the new password'
        ],
        category: 'Access'
      },
      {
        id: 'sol_2',
        problem: 'close_background_apps',
        title: 'Optimize System Performance',
        steps: [
          'Press Ctrl+Shift+Esc to open Task Manager',
          'Click on the CPU column to sort by usage',
          'Identify and close unnecessary applications using high CPU',
          'Restart your computer to clear memory',
          'If the issue persists, consider a disk cleanup or contact IT'
        ],
        category: 'Performance'
      },
      {
        id: 'sol_3',
        problem: 'check_printer_connection',
        title: 'Fix Printer Connection Issues',
        steps: [
          'Check if the printer is powered on and has paper/toner',
          'Verify the USB or network cable is properly connected',
          'Go to Settings > Devices > Printers & Scanners on your computer',
          'Remove the printer and add it again',
          'Try printing a test page',
          'If still not working, update printer drivers or contact IT'
        ],
        category: 'Hardware'
      },
      {
        id: 'sol_4',
        problem: 'reconfigure_vpn_settings',
        title: 'VPN Configuration Fix',
        steps: [
          'Open your VPN client application',
          'Delete the existing VPN connection',
          'Create a new connection with the correct server address',
          'Ensure your internet connection is stable',
          'Try connecting again',
          'Contact IT if the issue persists'
        ],
        category: 'Network'
      },
      {
        id: 'sol_5',
        problem: 'reinstall_application',
        title: 'Reinstall Application',
        steps: [
          'Go to Control Panel > Programs and Features',
          'Find and uninstall the problematic application',
          'Restart your computer',
          'Download the latest version from the official website or company portal',
          'Install the application with administrator privileges',
          'Launch the application and verify it works correctly'
        ],
        category: 'Software'
      },
      {
        id: 'sol_6',
        problem: 'check_network_settings',
        title: 'Fix Network Connection',
        steps: [
          'Check if other devices can connect to the network',
          'Turn WiFi off and on again on your device',
          'Forget the network and reconnect with the password',
          'Restart your router if you have access',
          'Check if airplane mode is off',
          'Run Windows Network Troubleshooter (Right-click network icon)',
          'Contact IT if the problem continues'
        ],
        category: 'Network'
      },
    ];
    await kv.set('kb_solutions', defaultSolutions);

    const defaultSymptoms = [
      { id: 'cannot_access_email', label: 'Cannot access email', category: 'Email' },
      { id: 'authentication_error', label: 'Getting authentication error', category: 'Access' },
      { id: 'slow_computer', label: 'Computer is slow', category: 'Performance' },
      { id: 'high_cpu_usage', label: 'High CPU usage', category: 'Performance' },
      { id: 'cannot_print', label: 'Cannot print documents', category: 'Hardware' },
      { id: 'printer_offline', label: 'Printer shows offline', category: 'Hardware' },
      { id: 'cannot_connect_vpn', label: 'Cannot connect to VPN', category: 'Network' },
      { id: 'vpn_timeout', label: 'VPN connection times out', category: 'Network' },
      { id: 'application_crash', label: 'Application crashes', category: 'Software' },
      { id: 'error_message_shown', label: 'Error message appears', category: 'Software' },
      { id: 'no_internet', label: 'No internet connection', category: 'Network' },
      { id: 'wifi_not_detected', label: 'WiFi not detected', category: 'Network' },
      { id: 'forgot_password', label: 'Forgot password', category: 'Access' },
      { id: 'account_locked', label: 'Account is locked', category: 'Access' },
    ];
    await kv.set('kb_symptoms', defaultSymptoms);
  }
};

// Initialize on startup
await initializeKnowledgeBase();

// Get all symptoms (for the problem reporting form)
app.get("/make-server-688b6236/kb/symptoms", async (c: any) => {
  try {
    const symptoms = await kv.get('kb_symptoms') || [];
    return c.json({ symptoms });
  } catch (error) {
    console.error('Error fetching symptoms:', error);
    return c.json({ error: 'Failed to fetch symptoms' }, 500);
  }
});

// Get all rules (for IT Support)
app.get("/make-server-688b6236/kb/rules", requireAuth, async (c: any) => {
  try {
    const rules = await kv.get('kb_rules') || [];
    return c.json({ rules });
  } catch (error) {
    console.error('Error fetching rules:', error);
    return c.json({ error: 'Failed to fetch rules' }, 500);
  }
});

// Add new rule (IT Support only)
app.post("/make-server-688b6236/kb/rules", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    if (user.user_metadata?.role !== 'support') {
      return c.json({ error: 'Forbidden: IT Support access required' }, 403);
    }

    const newRule = await c.req.json();
    const rules = await kv.get('kb_rules') || [];
    rules.push({ ...newRule, id: `rule_${Date.now()}` });
    await kv.set('kb_rules', rules);

    return c.json({ success: true, rules });
  } catch (error) {
    console.error('Error adding rule:', error);
    return c.json({ error: 'Failed to add rule' }, 500);
  }
});

// Update rule (IT Support only)
app.put("/make-server-688b6236/kb/rules/:id", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    if (user.user_metadata?.role !== 'support') {
      return c.json({ error: 'Forbidden: IT Support access required' }, 403);
    }

    const ruleId = c.req.param('id');
    const updatedRule = await c.req.json();
    const rules = await kv.get('kb_rules') || [];
    const index = rules.findIndex((r: any) => r.id === ruleId);
    
    if (index === -1) {
      return c.json({ error: 'Rule not found' }, 404);
    }

    rules[index] = { ...updatedRule, id: ruleId };
    await kv.set('kb_rules', rules);

    return c.json({ success: true, rules });
  } catch (error) {
    console.error('Error updating rule:', error);
    return c.json({ error: 'Failed to update rule' }, 500);
  }
});

// Delete rule (IT Support only)
app.delete("/make-server-688b6236/kb/rules/:id", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    if (user.user_metadata?.role !== 'support') {
      return c.json({ error: 'Forbidden: IT Support access required' }, 403);
    }

    const ruleId = c.req.param('id');
    const rules = await kv.get('kb_rules') || [];
    const filteredRules = rules.filter((r: any) => r.id !== ruleId);
    await kv.set('kb_rules', filteredRules);

    return c.json({ success: true, rules: filteredRules });
  } catch (error) {
    console.error('Error deleting rule:', error);
    return c.json({ error: 'Failed to delete rule' }, 500);
  }
});

// Get all solutions
app.get("/make-server-688b6236/kb/solutions", async (c: any) => {
  try {
    const solutions = await kv.get('kb_solutions') || [];
    return c.json({ solutions });
  } catch (error) {
    console.error('Error fetching solutions:', error);
    return c.json({ error: 'Failed to fetch solutions' }, 500);
  }
});

// Add new solution (IT Support only)
app.post("/make-server-688b6236/kb/solutions", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    if (user.user_metadata?.role !== 'support') {
      return c.json({ error: 'Forbidden: IT Support access required' }, 403);
    }
 
    const newSolution = await c.req.json();
    const solutions = await kv.get('kb_solutions') || [];
    solutions.push({ ...newSolution, id: `sol_${Date.now()}` });
    await kv.set('kb_solutions', solutions);

    return c.json({ success: true, solutions });
  } catch (error) {
    console.error('Error adding solution:', error);
    return c.json({ error: 'Failed to add solution' }, 500);
  }
});

// ============ DB-BACKED SEARCH (symptoms -> damages -> solutions) ============

const extractSymptomsFromDb = async (queryText: string) => {
  const supabase = getSupabaseAdmin();
  const { data: symptoms, error } = await supabase
    .from('symptoms')
    .select('id, code, name, category');
  if (error) {
    console.error('Error fetching symptoms from DB:', error);
    return [];
  }

  const matchedSymptoms: any[] = [];
  const lowerQuery = queryText.toLowerCase();

  for (const symptom of (symptoms || [])) {
    const lowerName = symptom.name.toLowerCase();
    const lowerCode = symptom.code.toLowerCase();
    
    // Check direct match
    if (lowerQuery.includes(lowerName) || lowerQuery.includes(lowerCode)) {
      matchedSymptoms.push(symptom);
    } else {
      // Check keyword overlap (all words of symptom name in query)
      const words = lowerName.split(/\s+/).filter((w: string) => w.length > 2);
      if (words.length > 0 && words.every((w: string) => lowerQuery.includes(w))) {
        matchedSymptoms.push(symptom);
      }
    }
  }

  return matchedSymptoms;
};

const databaseForwardChaining = async (initialSymptomCodes: string[]) => {
  const supabase = getSupabaseAdmin();

  // Fetch all rules from database
  const { data: dbRules, error: rulesErr } = await supabase
    .from('rules')
    .select('code, damage_code, symptom_codes, confidence');
  if (rulesErr) throw new Error(rulesErr.message);

  // Fetch all solutions from database
  const { data: dbSolutions, error: solErr } = await supabase
    .from('solutions')
    .select('id, code, damage_code, description, steps');
  if (solErr) throw new Error(solErr.message);

  // Fetch all damages from database
  const { data: dbDamages, error: dmgErr } = await supabase
    .from('damages')
    .select('code, name, description');
  if (dmgErr) throw new Error(dmgErr.message);

  const workingMemory = new Set<string>(initialSymptomCodes);
  const inferredFacts: string[] = []; // damage codes
  const usedRules: any[] = [];
  let changed = true;

  while (changed) {
    changed = false;
    for (const rule of (dbRules || [])) {
      const allConditionsMet = Array.isArray(rule.symptom_codes) && rule.symptom_codes.every((cond: string) => workingMemory.has(cond));
      if (allConditionsMet && !workingMemory.has(rule.damage_code)) {
        workingMemory.add(rule.damage_code);
        inferredFacts.push(rule.damage_code);
        usedRules.push(rule);
        changed = true;
      }
    }
  }

  const matchedSolutions = (dbSolutions || []).filter((sol: any) => workingMemory.has(sol.damage_code));
  const matchedDamages = (dbDamages || []).filter((dmg: any) => workingMemory.has(dmg.code));

  return {
    inferredFacts,
    usedRules,
    solutions: matchedSolutions,
    damages: matchedDamages,
    allFacts: Array.from(workingMemory)
  };
};

// GET: search via query string in symptoms name
app.get("/make-server-688b6236/kb/search", async (c: any) => {
  try {
    const url = new URL(c.req.url);
    const query = url.searchParams.get('query') || '';
    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }

    const matchedSymptoms = await extractSymptomsFromDb(query);
    if (matchedSymptoms.length === 0) {
      return c.json({
        success: true,
        symptoms: [],
        rules: [],
        damages: [],
        solutions: []
      });
    }

    const symptomCodes = matchedSymptoms.map(s => s.code);
    const fcResult = await databaseForwardChaining(symptomCodes);

    return c.json({
      success: true,
      symptoms: matchedSymptoms,
      rules: fcResult.usedRules,
      damages: fcResult.damages,
      solutions: fcResult.solutions
    });
  } catch (error) {
    console.error('KB search error:', error);
    return c.json({ error: 'Failed to search knowledge base' }, 500);
  }
});

// POST: search with explicit symptom codes and/or query
app.post("/make-server-688b6236/kb/search", async (c: any) => {
  try {
    const body = await c.req.json();
    const query = typeof body?.query === 'string' ? (body.query as string) : undefined;
    const symptomCodesBody: string[] = Array.isArray(body?.symptomCodes) ? (body.symptomCodes as string[]).map((c: any) => String(c)) : [];

    let matchedSymptoms: any[] = [];

    // 1. Fetch symptoms from DB based on explicit symptom codes sent by frontend
    if (symptomCodesBody.length > 0) {
      const supabase = getSupabaseAdmin();
      const { data: dbSymptomsByCode } = await supabase
        .from('symptoms')
        .select('id, code, name, category')
        .in('code', symptomCodesBody);
      if (dbSymptomsByCode && dbSymptomsByCode.length > 0) {
        matchedSymptoms.push(...dbSymptomsByCode);
      }
    }

    // 2. Also extract symptoms from the query text using database names/codes
    if (query) {
      const dbExtracted = await extractSymptomsFromDb(query);
      for (const sym of dbExtracted) {
        if (!matchedSymptoms.some(s => s.code === sym.code)) {
          matchedSymptoms.push(sym);
        }
      }
    }

    if (matchedSymptoms.length === 0) {
      return c.json({
        success: true,
        symptoms: [],
        rules: [],
        damages: [],
        solutions: []
      });
    }

    const symptomCodes = matchedSymptoms.map(s => s.code);
    const fcResult = await databaseForwardChaining(symptomCodes);

    return c.json({
      success: true,
      symptoms: matchedSymptoms,
      rules: fcResult.usedRules,
      damages: fcResult.damages,
      solutions: fcResult.solutions
    });
  } catch (error) {
    console.error('KB search error:', error);
    return c.json({ error: 'Failed to search knowledge base' }, 500);
  }
});

// Seed data endpoint
app.post("/make-server-688b6236/kb/seed", async (c: any) => {
  try {
    const supabase = getSupabaseAdmin();

    // Delete in correct dependency order
    await supabase.from('rules').delete().neq('id', 0);
    await supabase.from('solutions').delete().neq('id', 0);
    await supabase.from('symptoms').delete().neq('id', 0);
    await supabase.from('damages').delete().neq('id', 0);

    // Insert damages
    const { error: dmgErr } = await supabase.from('damages').insert([
      { "code": "K01", "name": "Kerusakan Layar/Laptop Tidak Menyala", "description": "Kerusakan Layar/Laptop Tidak Menyala" },
      { "code": "K02", "name": "Kerusakan Printer", "description": "Kerusakan Printer" },
      { "code": "K03", "name": "Kerusakan Touchpad", "description": "Kerusakan Touchpad" },
      { "code": "K04", "name": "Kerusakan Keyboard", "description": "Kerusakan Keyboard" },
      { "code": "K05", "name": "Kerusakan Charger Laptop", "description": "Kerusakan Charger Laptop" },
      { "code": "K06", "name": "Kerusakan Baterai Laptop", "description": "Kerusakan Baterai Laptop" },
      { "code": "K07", "name": "Kerusakan Audio Software", "description": "Kerusakan Audio Software" },
      { "code": "K08", "name": "Kerusakan Audio Hardware", "description": "Kerusakan Audio Hardware" },
      { "code": "K09", "name": "Kerusakan Harddisk atau Sistem Operasi", "description": "Kerusakan Harddisk atau Sistem Operasi" },
      { "code": "K10", "name": "Kerusakan Peripheral (Scanner, USB, dsb)", "description": "Kerusakan Peripheral (Scanner, USB, dsb)" },
      { "code": "K11", "name": "Kerusakan Jaringan/Internet", "description": "Kerusakan Jaringan/Internet" },
      { "code": "K12", "name": "Masalah File Sharing atau Server Internal", "description": "Masalah File Sharing atau Server Internal" },
      { "code": "K13", "name": "Masalah Pemutaran Audio Terjadwal", "description": "Masalah Pemutaran Audio Terjadwal" },
      { "code": "K14", "name": "Masalah Server Aplikasi scan.peb.co.id", "description": "Masalah Server Aplikasi scan.peb.co.id" },
      { "code": "K15", "name": "Masalah Aplikasi Accurate", "description": "Masalah Aplikasi Accurate" }
    ]);
    if (dmgErr) throw new Error("Damages seed error: " + dmgErr.message);

    // Insert symptoms
    const { error: symErr } = await supabase.from('symptoms').insert([
      { "code": "G01", "name": "Laptop tidak menyala/mati total", "category": "Hardware" },
      { "code": "G02", "name": "Layar laptop menampilkan garis-garis", "category": "Hardware" },
      { "code": "G03", "name": "Printer tidak terdeteksi pada sistem", "category": "Printer" },
      { "code": "G04", "name": "Printer tidak mengeluarkan hasil cetak", "category": "Printer" },
      { "code": "G05", "name": "Kursor tidak bisa bergerak saat penggunaan touchpad", "category": "Touchpad" },
      { "code": "G06", "name": "Kursor bergerak sendiri tanpa pengoperasian pengguna", "category": "Touchpad" },
      { "code": "G07", "name": "Klik kanan pada touchpad tidak berfungsi", "category": "Touchpad" },
      { "code": "G08", "name": "Keyboard tidak mengeluarkan input", "category": "Keyboard" },
      { "code": "G09", "name": "Keyboard mengetik sendiri tanpa pengoperasian", "category": "Keyboard" },
      { "code": "G10", "name": "Laptop mengisi daya dalam waktu yang lama", "category": "Power" },
      { "code": "G11", "name": "Baterai cepat habis setelah diisi penuh", "category": "Power" },
      { "code": "G12", "name": "Laptop tidak mengisi daya saat disambungkan", "category": "Power" },
      { "code": "G13", "name": "Lampu indikator pengisian daya tidak menyala", "category": "Power" },
      { "code": "G14", "name": "Perangkat suara tidak terdeteksi", "category": "Audio" },
      { "code": "G15", "name": "Laptop tidak mengeluarkan suara", "category": "Audio" },
      { "code": "G16", "name": "Laptop hang atau crash saat membuka aplikasi", "category": "OS" },
      { "code": "G17", "name": "Kinerja laptop sangat lambat", "category": "OS" },
      { "code": "G18", "name": "Laptop berhenti di sistem operasi saat booting", "category": "OS" },
      { "code": "G19", "name": "Muncul bluescreen saat digunakan", "category": "OS" },
      { "code": "G20", "name": "Terdapat error “checking disk” saat booting", "category": "OS" },
      { "code": "G21", "name": "Laptop melakukan restart sendiri", "category": "OS" },
      { "code": "G22", "name": "Harddisk tidak terdeteksi", "category": "OS" },
      { "code": "G23", "name": "Laptop mati tiba-tiba saat digunakan", "category": "OS" },
      { "code": "G24", "name": "Sistem operasi gagal loading", "category": "OS" },
      { "code": "G25", "name": "CD/DVD drive tidak bisa terbuka", "category": "Peripheral" },
      { "code": "G26", "name": "Perangkat eksternal tidak terdeteksi", "category": "Peripheral" },
      { "code": "G27", "name": "Perangkat eksternal terhubung tapi tidak berfungsi", "category": "Peripheral" },
      { "code": "G32", "name": "Jaringan Wi-Fi tidak terhubung", "category": "Network" },
      { "code": "G33", "name": "Koneksi internet terputus-putus", "category": "Network" },
      { "code": "G34", "name": "Tidak bisa mengakses file sharing server", "category": "Server" },
      { "code": "G35", "name": "Scanner tidak berfungsi atau tidak dapat diakses", "category": "Peripheral" },
      { "code": "G36", "name": "Lagu Indonesia Raya tidak berbunyi saat jadwal otomatis", "category": "Scheduler" },
      { "code": "G37", "name": "Speaker Bluetooth tidak terkoneksi", "category": "Audio" },
      { "code": "G38", "name": "Task Scheduler tidak berjalan", "category": "Scheduler" },
      { "code": "G39", "name": "Website scan.peb.co.id tidak dapat diakses", "category": "Server" },
      { "code": "G40", "name": "Database server XAMPP tidak aktif", "category": "Server" },
      { "code": "G41", "name": "Accurate tidak dapat dibuka / tidak dapat digunakan", "category": "Software" },
      { "code": "G42", "name": "Firebird Service tidak berjalan", "category": "Software" }
    ]);
    if (symErr) throw new Error("Symptoms seed error: " + symErr.message);

    // Insert rules
    const { error: rulesErr } = await supabase.from('rules').insert([
      { "code": "RULE001", "damage_code": "K01", "symptom_codes": ["G01", "G02"], "confidence": 0.8 },
      { "code": "RULE002", "damage_code": "K02", "symptom_codes": ["G03", "G04"], "confidence": 0.8 },
      { "code": "RULE003", "damage_code": "K03", "symptom_codes": ["G05", "G06", "G07"], "confidence": 0.85 },
      { "code": "RULE004", "damage_code": "K04", "symptom_codes": ["G08", "G09"], "confidence": 0.8 },
      { "code": "RULE005", "damage_code": "K05", "symptom_codes": ["G10", "G13"], "confidence": 0.8 },
      { "code": "RULE006", "damage_code": "K06", "symptom_codes": ["G11", "G12"], "confidence": 0.8 },
      { "code": "RULE007", "damage_code": "K07", "symptom_codes": ["G14"], "confidence": 0.8 },
      { "code": "RULE008", "damage_code": "K08", "symptom_codes": ["G15"], "confidence": 0.8 },
      { "code": "RULE009", "damage_code": "K09", "symptom_codes": ["G16", "G17", "G18", "G19", "G20"], "confidence": 0.9 },
      { "code": "RULE010", "damage_code": "K09", "symptom_codes": ["G21", "G22", "G23", "G24"], "confidence": 0.85 },
      { "code": "RULE011", "damage_code": "K10", "symptom_codes": ["G25", "G26", "G27", "G35"], "confidence": 0.8 },
      { "code": "RULE012", "damage_code": "K11", "symptom_codes": ["G32", "G33"], "confidence": 0.8 },
      { "code": "RULE013", "damage_code": "K12", "symptom_codes": ["G34"], "confidence": 0.8 },
      { "code": "RULE014", "damage_code": "K13", "symptom_codes": ["G36", "G37", "G38"], "confidence": 0.85 },
      { "code": "RULE015", "damage_code": "K14", "symptom_codes": ["G39", "G40"], "confidence": 0.85 },
      { "code": "RULE016", "damage_code": "K15", "symptom_codes": ["G41", "G42"], "confidence": 0.9 }
    ]);
    if (rulesErr) throw new Error("Rules seed error: " + rulesErr.message);

    // Insert solutions
    const { error: solErr } = await supabase.from('solutions').insert([
      { "code": "SOL001", "damage_code": "K01", "description": "Periksa adaptor daya, kabel, dan RAM; pastikan layar tidak rusak dan indikator power menyala." },
      { "code": "SOL002", "damage_code": "K02", "description": "Pastikan driver printer terinstal, cek koneksi USB atau jaringan, dan lakukan tes cetak." },
      { "code": "SOL003", "damage_code": "K03", "description": "Aktifkan touchpad melalui pengaturan, update driver, atau gunakan mouse eksternal sementara." },
      { "code": "SOL004", "damage_code": "K04", "description": "Bersihkan keyboard, cek konektor, dan uji dengan keyboard eksternal." },
      { "code": "SOL005", "damage_code": "K05", "description": "Coba gunakan charger lain dengan spesifikasi sama, periksa kabel dan adaptor; pastikan port daya laptop tidak longgar." },
      { "code": "SOL006", "damage_code": "K06", "description": "Kalibrasi baterai melalui BIOS, pastikan konektor baterai tidak kendor, dan ganti baterai jika kapasitasnya menurun." },
      { "code": "SOL007", "damage_code": "K07", "description": "Instal ulang driver audio, periksa Device Manager dan pastikan perangkat suara aktif." },
      { "code": "SOL008", "damage_code": "K08", "description": "Coba gunakan headset eksternal; jika tetap tidak ada suara, periksa jack audio atau speaker internal." },
      { "code": "SOL009", "damage_code": "K09", "description": "Jalankan safe mode, periksa harddisk dari bad sector, dan lakukan system restore jika perlu." },
      { "code": "SOL010", "damage_code": "K10", "description": "Pastikan kabel terpasang, instal ulang driver perangkat eksternal, dan uji di port USB lain." },
      { "code": "SOL011", "damage_code": "K11", "description": "Periksa router dan koneksi Wi-Fi, pastikan IP address benar, dan jaringan tidak dibatasi firewall." },
      { "code": "SOL012", "damage_code": "K12", "description": "Pastikan server file sharing aktif, periksa izin akses, dan pastikan koneksi jaringan stabil." },
      { "code": "SOL013", "damage_code": "K13", "description": "Periksa koneksi speaker Bluetooth; pastikan perangkat tersambung. Cek Task Scheduler dan pastikan job berjalan sesuai jadwal." },
      { "code": "SOL014", "damage_code": "K14", "description": "Pastikan koneksi internet stabil; periksa status server XAMPP/database pada PC server; restart service jika diperlukan." },
      { "code": "SOL015", "damage_code": "K15", "description": "Cek PC server dan pastikan Firebird Service berjalan; pastikan koneksi Accurate dapat mengakses database server." }
    ]);
    if (solErr) throw new Error("Solutions seed error: " + solErr.message);

    return c.json({ success: true, message: "Database tables seeded successfully!" });
  } catch (error: any) {
    console.error('Seeding error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update solution (IT Support only)
app.put("/make-server-688b6236/kb/solutions/:id", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    if (user.user_metadata?.role !== 'support') {
      return c.json({ error: 'Forbidden: IT Support access required' }, 403);
    }

    const solId = c.req.param('id');
    const updatedSolution = await c.req.json();
    const solutions = await kv.get('kb_solutions') || [];
    const index = solutions.findIndex((s: any) => s.id === solId);
    
    if (index === -1) {
      return c.json({ error: 'Solution not found' }, 404);
    }

    solutions[index] = { ...updatedSolution, id: solId };
    await kv.set('kb_solutions', solutions);

    return c.json({ success: true, solutions });
  } catch (error) {
    console.error('Error updating solution:', error);
    return c.json({ error: 'Failed to update solution' }, 500);
  }
});

// Delete solution (IT Support only)
app.delete("/make-server-688b6236/kb/solutions/:id", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    if (user.user_metadata?.role !== 'support') {
      return c.json({ error: 'Forbidden: IT Support access required' }, 403);
    }

    const solId = c.req.param('id');
    const solutions = await kv.get('kb_solutions') || [];
    const filteredSolutions = solutions.filter((s: any) => s.id !== solId);
    await kv.set('kb_solutions', filteredSolutions);

    return c.json({ success: true, solutions: filteredSolutions });
  } catch (error) {
    console.error('Error deleting solution:', error);
    return c.json({ error: 'Failed to delete solution' }, 500);
  }
});

// ============ FORWARD CHAINING INFERENCE ENGINE ============

const forwardChaining = async (facts: string[]) => {
  const rules = await kv.get('kb_rules') || [];
  const solutions = await kv.get('kb_solutions') || [];
  
  const workingMemory = new Set(facts);
  const inferredFacts: string[] = [];
  const usedRules: any[] = [];
  let changed = true;

  // Iterate until no new facts can be inferred
  while (changed) {
    changed = false;
    
    for (const rule of rules) {
      // Check if all conditions are in working memory
      const allConditionsMet = rule.conditions.every((cond: string) => workingMemory.has(cond));
      
      // Check if conclusion is not already in working memory
      if (allConditionsMet && !workingMemory.has(rule.conclusion)) {
        workingMemory.add(rule.conclusion);
        inferredFacts.push(rule.conclusion);
        usedRules.push(rule);
        changed = true;
      }
    }
  }

  // Find solutions for inferred problems
  const foundSolutions = solutions.filter((sol: any) => 
    workingMemory.has(sol.problem)
  );

  return {
    inferredFacts,
    usedRules,
    solutions: foundSolutions,
    allFacts: Array.from(workingMemory)
  };
};

// Run inference on reported symptoms
app.post("/make-server-688b6236/inference/analyze", requireAuth, async (c: any) => {
  try {
    const { symptoms, description } = await c.req.json();
    
    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return c.json({ error: 'No symptoms provided' }, 400);
    }

    const result = await forwardChaining(symptoms);

    return c.json({
      success: true,
      symptoms,
      description,
      ...result,
      hasSolution: result.solutions.length > 0
    });
  } catch (error) {
    console.error('Inference error:', error);
    return c.json({ error: 'Failed to analyze problem' }, 500);
  }
});

// ============ REPORT ENDPOINTS ============

// Submit a new report
app.post("/make-server-688b6236/reports/submit", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    const { symptoms, description, inferenceResult } = await c.req.json();

    const report = {
      id: `report_${Date.now()}`,
      userId: user.id,
      userName: user.user_metadata?.name || user.email,
      symptoms,
      description,
      inferenceResult,
      hasSolution: inferenceResult?.solutions?.length > 0,
      createdAt: new Date().toISOString(),
      status: inferenceResult?.solutions?.length > 0 ? 'resolved_auto' : 'pending'
    };

    // Store report
    const reportKey = `report_${user.id}_${report.id}`;
    await kv.set(reportKey, report);

    // Add to user's report list
    const userReportsKey = `user_reports_${user.id}`;
    const userReports = await kv.get(userReportsKey) || [];
    userReports.unshift(report.id);
    await kv.set(userReportsKey, userReports);

    return c.json({ success: true, report });
  } catch (error) {
    console.error('Report submission error:', error);
    return c.json({ error: 'Failed to submit report' }, 500);
  }
});

// Get user's report history
app.get("/make-server-688b6236/reports/history", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    const userReportsKey = `user_reports_${user.id}`;
    const reportIds = await kv.get(userReportsKey) || [];

    const reports: any[] = [];
    for (const reportId of reportIds) {
      const reportKey = `report_${user.id}_${reportId}`;
      const report = await kv.get(reportKey);
      if (report) {
        reports.push(report);
      }
    }

    return c.json({ success: true, reports });
  } catch (error) {
    console.error('Error fetching report history:', error);
    return c.json({ error: 'Failed to fetch report history' }, 500);
  }
});

// Get specific report
app.get("/make-server-688b6236/reports/:id", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    const reportId = c.req.param('id');
    const reportKey = `report_${user.id}_${reportId}`;
    const report = await kv.get(reportKey);

    if (!report) {
      return c.json({ error: 'Report not found' }, 404);
    }

    return c.json({ success: true, report });
  } catch (error) {
    console.error('Error fetching report:', error);
    return c.json({ error: 'Failed to fetch report' }, 500);
  }
});

// ============ TICKET ENDPOINTS ============

// Create a ticket (when no automatic solution is found)
app.post("/make-server-688b6236/tickets/create", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    const { reportId, title, description, symptoms, category, priority } = await c.req.json();

    const ticket = {
      id: `ticket_${Date.now()}`,
      reportId,
      title,
      description,
      symptoms,
      category: category || 'Other',
      priority: priority || 'medium',
      status: 'open',
      submittedBy: user.user_metadata?.name || user.email,
      userId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      comments: []
    };

    // Store ticket
    await kv.set(`ticket_${ticket.id}`, ticket);

    // Add to tickets list
    const allTickets = await kv.get('all_tickets') || [];
    allTickets.unshift(ticket.id);
    await kv.set('all_tickets', allTickets);

    // Add to user's tickets
    const userTicketsKey = `user_tickets_${user.id}`;
    const userTickets = await kv.get(userTicketsKey) || [];
    userTickets.unshift(ticket.id);
    await kv.set(userTicketsKey, userTickets);

    return c.json({ success: true, ticket });
  } catch (error) {
    console.error('Ticket creation error:', error);
    return c.json({ error: 'Failed to create ticket' }, 500);
  }
});

// Get all tickets (IT Support)
app.get("/make-server-688b6236/tickets/all", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    if (user.user_metadata?.role !== 'support') {
      return c.json({ error: 'Forbidden: IT Support access required' }, 403);
    }

    const ticketIds = await kv.get('all_tickets') || [];
    const tickets: any[] = [];

    for (const ticketId of ticketIds) {
      const ticket = await kv.get(`ticket_${ticketId}`);
      if (ticket) {
        tickets.push(ticket);
      }
    }

    return c.json({ success: true, tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return c.json({ error: 'Failed to fetch tickets' }, 500);
  }
});

// Get user's tickets
app.get("/make-server-688b6236/tickets/my", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    const userTicketsKey = `user_tickets_${user.id}`;
    const ticketIds = await kv.get(userTicketsKey) || [];

    const tickets: any[] = [];
    for (const ticketId of ticketIds) {
      const ticket = await kv.get(`ticket_${ticketId}`);
      if (ticket) {
        tickets.push(ticket);
      }
    }

    return c.json({ success: true, tickets });
  } catch (error) {
    console.error('Error fetching user tickets:', error);
    return c.json({ error: 'Failed to fetch tickets' }, 500);
  }
});

// Update ticket (IT Support)
app.put("/make-server-688b6236/tickets/:id", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    if (user.user_metadata?.role !== 'support') {
      return c.json({ error: 'Forbidden: IT Support access required' }, 403);
    }

    const ticketId = c.req.param('id');
    const updates = await c.req.json();
    
    const ticket = await kv.get(`ticket_${ticketId}`);
    if (!ticket) {
      return c.json({ error: 'Ticket not found' }, 404);
    }

    const updatedTicket = {
      ...ticket,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await kv.set(`ticket_${ticketId}`, updatedTicket);

    return c.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    console.error('Error updating ticket:', error);
    return c.json({ error: 'Failed to update ticket' }, 500);
  }
});

// Add comment to ticket
app.post("/make-server-688b6236/tickets/:id/comment", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    const ticketId = c.req.param('id');
    const { content } = await c.req.json();

    const ticket = await kv.get(`ticket_${ticketId}`);
    if (!ticket) {
      return c.json({ error: 'Ticket not found' }, 404);
    }

    const comment = {
      id: `comment_${Date.now()}`,
      author: user.user_metadata?.name || user.email,
      authorRole: user.user_metadata?.role || 'user',
      content,
      timestamp: new Date().toISOString()
    };

    ticket.comments = ticket.comments || [];
    ticket.comments.push(comment);
    ticket.updatedAt = new Date().toISOString();

    await kv.set(`ticket_${ticketId}`, ticket);

    return c.json({ success: true, ticket });
  } catch (error) {
    console.error('Error adding comment:', error);
    return c.json({ error: 'Failed to add comment' }, 500);
  }
});

// Get specific ticket
app.get("/make-server-688b6236/tickets/:id", requireAuth, async (c: any) => {
  try {
    const user = c.get('user');
    const ticketId = c.req.param('id');
    const ticket = await kv.get(`ticket_${ticketId}`);

    if (!ticket) {
      return c.json({ error: 'Ticket not found' }, 404);
    }

    // Check if user has access to this ticket
    const isSupport = user.user_metadata?.role === 'support';
    const isOwner = ticket.userId === user.id;

    if (!isSupport && !isOwner) {
      return c.json({ error: 'Forbidden: Access denied' }, 403);
    }

    return c.json({ success: true, ticket });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return c.json({ error: 'Failed to fetch ticket' }, 500);
  }
});

Deno.serve(app.fetch);
