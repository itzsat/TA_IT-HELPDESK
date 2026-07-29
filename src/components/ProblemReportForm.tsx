import React, { useState, useEffect, type ChangeEvent } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { CheckCircle2, AlertCircle, Loader2, Send, Ticket as TicketIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabaseAnonKey, getSupabaseHttpOrigin } from '../utils/supabase/publicConfig';
import { supabaseAdmin } from '../utils/supabase/adminClient';
import { User } from '../App';


interface ProblemReportFormProps {
  accessToken: string;
  user: User;
  onSuccess?: () => void;
}

interface DbSymptom {
  id: number;
  code: string;
  name: string;
  category: string;
}

interface DbRule {
  id: number;
  code: string;
  damage_code: string;
  symptom_codes: string[];
  confidence: number;
}

interface DbDamage {
  id: number;
  code: string;
  name: string;
  description: string;
}

interface DbSolution {
  id: number;
  code: string;
  damage_code: string;
  description: string;
  steps?: string[] | string | any;
}

interface InferenceResult {
  symptoms: DbSymptom[];
  damages: DbDamage[];
  solutions: DbSolution[];
  usedRules: DbRule[];
  hasSolution: boolean;
}

// ============ FORWARD CHAINING ENGINE (database-backed, runs on frontend) ============

function runForwardChaining(
  matchedSymptomResults: Array<{ symptom: DbSymptom; score: number }>,
  allRules: DbRule[],
  allDamages: DbDamage[],
  allSolutions: DbSolution[]
): { damages: DbDamage[]; solutions: DbSolution[]; usedRules: DbRule[] } {
  const symptomCF = new Map<string, number>();
  matchedSymptomResults.forEach(ms => symptomCF.set(ms.symptom.code, ms.score));

  const workingMemory = new Set<string>(matchedSymptomResults.map(ms => ms.symptom.code));
  const usedRules: DbRule[] = [];
  let changed = true;
  const damageCF = new Map<string, number>();

  // === PASS 1: Strict Forward Chaining (ALL conditions must be met) ===
  while (changed) {
    changed = false;
    for (const rule of allRules) {
      if (!Array.isArray(rule.symptom_codes) || rule.symptom_codes.length === 0) continue;
      const allMet = rule.symptom_codes.every(code => workingMemory.has(code));
      if (allMet) {
        // Sesuai dengan rumus di skripsi: Confidence = (Gejala Cocok / Total Gejala) * 100%
        // Karena di PASS 1 semua gejala cocok (allMet = true), maka rasio pasti 1.0 (100%)
        const ruleMatchCF = 1.0;

        if (!workingMemory.has(rule.damage_code) || (damageCF.get(rule.damage_code) || 0) < ruleMatchCF) {
          workingMemory.add(rule.damage_code);
          if (!usedRules.includes(rule)) usedRules.push(rule);

          const existingCF = damageCF.get(rule.damage_code) || 0;
          const newCF = existingCF + ruleMatchCF * (1 - existingCF);
          damageCF.set(rule.damage_code, newCF);
          changed = true;
        }
      }
    }
  }

  let matchedDamages = allDamages.filter(d => (damageCF.get(d.code) || 0) >= 0.4);
  let matchedSolutions = allSolutions.filter(s => matchedDamages.some(d => d.code === s.damage_code));

  // === PASS 2: Partial matching fallback — fire if ≥50% conditions met ===
  if (matchedSolutions.length === 0 && matchedSymptomResults.length > 0) {
    for (const rule of allRules) {
      if (!Array.isArray(rule.symptom_codes) || rule.symptom_codes.length === 0) continue;
      const matched = rule.symptom_codes.filter(code => workingMemory.has(code));
      const ratio = matched.length / rule.symptom_codes.length;
      
      if (matched.length >= 1 && (rule.symptom_codes.length === 1 || ratio >= 0.5)) {
        // Sesuai dengan rumus di skripsi: Confidence = (Gejala Cocok / Total Gejala) * 100%
        // Asumsi bobot sama rata untuk setiap gejala karena DB tidak menyimpan bobot per gejala
        const ruleMatchCF = ratio;

        if (ruleMatchCF >= 0.3) {
          workingMemory.add(rule.damage_code);
          if (!usedRules.includes(rule)) usedRules.push(rule);

          const existingCF = damageCF.get(rule.damage_code) || 0;
          const newCF = existingCF + ruleMatchCF * (1 - existingCF);
          damageCF.set(rule.damage_code, newCF);
        }
      }
    }
    
    matchedDamages = allDamages.filter(d => (damageCF.get(d.code) || 0) >= 0.3);
    matchedSolutions = allSolutions.filter(s => matchedDamages.some(d => d.code === s.damage_code));
  }

  // Extend damages with calculated CF (dynamically typed)
  const finalDamages = matchedDamages.map(d => ({
    ...d,
    confidence: damageCF.get(d.code) || 0
  })).sort((a, b) => (b as any).confidence - (a as any).confidence);

  matchedSolutions = allSolutions
    .filter(s => finalDamages.some(d => d.code === s.damage_code))
    .sort((a, b) => {
      const confA = damageCF.get(a.damage_code) || 0;
      const confB = damageCF.get(b.damage_code) || 0;
      return confB - confA;
    });

  return { damages: finalDamages, solutions: matchedSolutions, usedRules };
}

// ============ SYMPTOM EXTRACTION FROM DATABASE ============

// Indonesian stop words to ignore during keyword matching
const STOP_WORDS = new Set([
  'tidak', 'pada', 'saat', 'dan', 'atau', 'yang', 'saja', 'tapi',
  'itu', 'ini', 'untuk', 'dari', 'dengan', 'oleh', 'di', 'ke', 'nya',
  'telah', 'sudah', 'sedang', 'akan', 'bisa', 'dapat', 'ada', 'juga',
  'saya', 'aku', 'laptop', 'komputer', 'perangkat', 'sistem', 'tanpa',
]);

const KEYWORD_ALIASES: Record<string, string[]> = {
  'website': ['web', 'situs', 'link', 'portal'],
  'scan.peb.co.id': ['scan', 'peb'],
  'akses': ['buka', 'dibuka', 'diakses', 'login', 'masuk', 'mengakses', 'gabisa buka'],
  'terdeteksi': ['kebaca', 'terbaca', 'dikenali', 'detect', 'deteksi'],
  'lambat': ['lemot', 'lag', 'ngelag', 'lelet', 'berat'],
  'cetak': ['print', 'ngeprint', 'mencetak'],
  'terhubung': ['konek', 'connect', 'koneksi', 'nyambung', 'sambung'],
  'mati': ['padam', 'off', 'tewas'],
  'rusak': ['error', 'crash', 'hang', 'bluescreen', 'blue screen'],
  'hidup': ['nyala', 'on', 'menyala'],
  'layar': ['screen', 'monitor'],
  'baterai': ['batere', 'battery', 'cas', 'charging', 'daya', 'charger'],
};

function areWordsEquivalent(w1: string, w2: string): boolean {
  if (w1.length > 3 && (w1.includes(w2) || w2.includes(w1))) return true;
  for (const [canonical, aliases] of Object.entries(KEYWORD_ALIASES)) {
    const group = [canonical, ...aliases];
    const match1 = group.some(a => w1.includes(a));
    const match2 = group.some(a => w2.includes(a));
    if (match1 && match2) return true;
  }
  return false;
}

function extractSymptomsFromQuery(query: string, dbSymptoms: DbSymptom[]): Array<{ symptom: DbSymptom; score: number }> {
  // Normalize query: lowercase, replace special chars, collapse spaces
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[\/\-\u201c\u201d\u2018\u2019"]/g, ' ')
      .replace(/[^\w\s\.]/g, ' ') // Keep dots for domain names
      .replace(/\s+/g, ' ')
      .trim();

  const normQuery = normalize(query);
  const queryWords = new Set(normQuery.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)));

  const results: Array<{ symptom: DbSymptom; score: number }> = [];

  for (const symptom of dbSymptoms) {
    const normName = normalize(symptom.name);
    const normCode = symptom.code.toLowerCase();
    let score = 0;

    // Strategy 1: Direct substring match (highest score)
    if (normQuery.includes(normName)) {
      score = 1.0;
    }
    // Strategy 2: If the user's query is a subset of the symptom name (e.g. "wifi error" in "koneksi wifi error")
    else if (normQuery.length > 5 && normName.includes(normQuery)) {
      score = 0.95;
    }
    // Strategy 3: Symptom code mentioned (e.g. "G01")
    else if (normQuery.includes(normCode)) {
      score = 0.9;
    }
    else {
      // Strategy 4: Keyword overlap, ignoring stop words
      const nameWords = normName.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
      if (nameWords.length === 0) continue;

      let fuzzyMatch = 0;
      for (const nameWord of nameWords) {
        for (const qWord of Array.from(queryWords)) {
          if (areWordsEquivalent(nameWord, qWord)) {
            fuzzyMatch++;
            break; // Move to next nameWord if matched
          }
        }
      }
      
      // Calculate balanced match ratio
      const queryMatchRatio = queryWords.size > 0 ? fuzzyMatch / queryWords.size : 0;
      const symptomMatchRatio = fuzzyMatch / nameWords.length;
      
      score = (queryMatchRatio + symptomMatchRatio) / 2;
      if (score < 0.5) continue; // Minimum threshold for better accuracy
    }

    results.push({ symptom, score });
  }

  // Sort by score descending, return top matches
  return results.sort((a, b) => b.score - a.score);
}


export function ProblemReportForm({ accessToken, user, onSuccess }: ProblemReportFormProps) {
  const [problemText, setProblemText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [inferenceResult, setInferenceResult] = useState<InferenceResult | null>(null);
  const [ticketCreating, setTicketCreating] = useState(false);

  // Database knowledge base loaded once
  const [dbSymptoms, setDbSymptoms] = useState<DbSymptom[]>([]);
  const [dbRules, setDbRules] = useState<DbRule[]>([]);
  const [dbDamages, setDbDamages] = useState<DbDamage[]>([]);
  const [dbSolutions, setDbSolutions] = useState<DbSolution[]>([]);
  const [kbLoaded, setKbLoaded] = useState(false);
  const [kbError, setKbError] = useState('');

  const supabaseUrl = getSupabaseHttpOrigin();
  const anonKey = getSupabaseAnonKey();

  // Load knowledge base from Supabase public tables (no auth needed)
  useEffect(() => {
    const loadKnowledgeBase = async () => {
      try {
        const headers = {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
        };

        const [symRes, ruleRes, dmgRes, solRes] = await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/symptoms?select=id,code,name,category&order=code`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/rules?select=id,code,damage_code,symptom_codes,confidence`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/damages?select=id,code,name,description`, { headers }),
          fetch(`${supabaseUrl}/rest/v1/solutions?select=id,code,damage_code,description,steps`, { headers }),
        ]);

        if (!symRes.ok || !ruleRes.ok || !dmgRes.ok || !solRes.ok) {
          throw new Error('Gagal memuat knowledge base dari database');
        }

        const [symptoms, rules, damages, solutions] = await Promise.all([
          symRes.json(),
          ruleRes.json(),
          dmgRes.json(),
          solRes.json(),
        ]);

        setDbSymptoms(symptoms || []);
        setDbRules(rules || []);
        setDbDamages(damages || []);
        setDbSolutions(solutions || []);
        setKbLoaded(true);
      } catch (err: any) {
        console.error('Error loading KB:', err);
        setKbError('Knowledge base tidak dapat dimuat. Pastikan koneksi internet aktif.');
      }
    };

    loadKnowledgeBase();
  }, []);

  const handleAnalyze = async () => {
    if (!problemText.trim()) {
      setError('Mohon jelaskan masalah Anda');
      return;
    }
    if (!kbLoaded) {
      setError('Knowledge base sedang dimuat, harap tunggu sebentar...');
      return;
    }

    setError('');
    setAnalyzing(true);
    setInferenceResult(null);

    try {
      toast.loading('Menganalisis masalah Anda...', {
        description: 'Menjalankan mesin inferensi Forward Chaining',
        id: 'analyzing',
      });

      // Step 1: Extract matching symptoms from user's query
      const matchedSymptomResults = extractSymptomsFromQuery(problemText, dbSymptoms);
      const matchedSymptoms = matchedSymptomResults.map(r => r.symptom);

      // Step 2: Run Forward Chaining on frontend using database rules and confidence factors
      const fcResult = runForwardChaining(matchedSymptomResults, dbRules, dbDamages, dbSolutions);

      const result: InferenceResult = {
        symptoms: matchedSymptoms,
        damages: fcResult.damages,
        solutions: fcResult.solutions,
        usedRules: fcResult.usedRules,
        hasSolution: fcResult.solutions.length > 0,
      };

      setInferenceResult(result);
      toast.dismiss('analyzing');


      // Save report to Supabase directly (FR-03)
      try {
        const reportId = `report_${Date.now()}`;
        const reportData = {
          id: reportId,
          userId: user.id,
          userName: user.user_metadata?.name || user.email,
          symptoms: matchedSymptoms.map(s => s.code),
          description: problemText,
          inferenceResult: result,
          hasSolution: result.hasSolution,
          createdAt: new Date().toISOString(),
          status: result.hasSolution ? 'resolved_auto' : 'pending',
        };
        await supabaseAdmin
          .from('kv_store_688b6236')
          .insert({ key: reportId, value: reportData });
      } catch {
        // non-critical, ignore
      }


    } catch (err: any) {
      console.error('Analysis error:', err);
      setError(err.message || 'Gagal menganalisis masalah');
      toast.dismiss('analyzing');
      toast.error('Analisis gagal', { description: err.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!inferenceResult) return;
    setTicketCreating(true);
    setError('');

    try {
      const ticketId = `ticket_${Date.now()}`;
      const ticket = {
        id: ticketId,
        reportId: null,
        title: problemText.substring(0, 100),
        description: problemText,
        symptoms: inferenceResult.symptoms.map(s => s.code),
        category: inferenceResult.symptoms[0]?.category || 'Other',
        priority: 'medium',
        status: 'open',
        submittedBy: user.user_metadata?.name || user.email || 'User',
        userId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        comments: []
      };

      const { error: dbErr } = await supabaseAdmin
        .from('kv_store_688b6236')
        .insert({ key: ticketId, value: ticket });

      if (dbErr) throw new Error(dbErr.message);

      setProblemText('');
      setInferenceResult(null);
      toast.success('Tiket dukungan berhasil dibuat!', {
        description: 'Masalah Anda telah dikirim ke tim Dukungan TI.',
      });

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal membuat tiket');
    } finally {
      setTicketCreating(false);
    }
  };

  const handleReset = () => {
    setProblemText('');
    setInferenceResult(null);
    setError('');
  };

  // ===== RESULT VIEW =====
  if (inferenceResult) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* User's message */}
        <Card className="border-slate-300">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                Anda
              </div>
              <div className="flex-1">
                <p className="text-slate-900">{problemText}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Response */}
        <Card className={inferenceResult.hasSolution ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 space-y-4">
                {inferenceResult.hasSolution ? (
                  <>
                    <div className="mb-4 pb-4 border-b border-blue-100 flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                          Saya menemukan solusi untuk Anda!
                        </h3>
                        <p className="text-xs text-blue-600 mt-1 opacity-70">
                          *Persentase didapat dari rata-rata keyakinan gejala × confidence aturan.
                        </p>
                      </div>
                    </div>

                    {/* Detected symptoms */}
                    {inferenceResult.symptoms.length > 0 && (
                      <div className="p-4 bg-white border border-green-200 rounded-lg">
                        <p className="text-green-900 font-medium mb-2">🔍 Gejala yang terdeteksi:</p>
                        <div className="flex flex-wrap gap-2">
                          {inferenceResult.symptoms.map(s => (
                            <Badge key={s.code} variant="outline" className="border-green-400 text-green-800">
                              [{s.code}] {s.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inferred damages */}
                    {inferenceResult.damages.length > 0 && (
                      <div className="p-4 bg-white border border-green-200 rounded-lg">
                        <p className="text-green-900 font-medium mb-2">⚡ Masalah yang teridentifikasi:</p>
                        <div className="flex flex-wrap gap-2">
                          {inferenceResult.damages.map(d => (
                            <Badge key={d.code} className="bg-purple-600">
                              [{d.code}] {d.name} {('confidence' in d && typeof d.confidence === 'number' && d.confidence > 0) ? `(${(d.confidence * 100).toFixed(1)}%)` : ''}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Solutions */}
                    {inferenceResult.solutions.map((solution, idx) => (
                      <div key={solution.id} className="p-5 bg-white border border-green-300 rounded-lg shadow-sm">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                            {idx + 1}
                          </div>
                          <div>
                            <h4 className="text-green-900 font-semibold mb-1">
                              {inferenceResult.damages.find(d => d.code === solution.damage_code)?.name || `Solusi ${solution.code}`}
                            </h4>
                            <Badge className="bg-green-600">
                              {inferenceResult.symptoms.find(s => 
                                inferenceResult.usedRules.some(r => r.damage_code === solution.damage_code && r.symptom_codes.includes(s.code))
                              )?.category || 'IT Support'}
                            </Badge>
                          </div>
                        </div>
                        <div className="pl-11">
                          <p className="text-green-800 text-sm font-medium mb-2">Langkah penyelesaian:</p>
                          {solution.description && <p className="text-green-900 font-semibold mb-2">{solution.description}</p>}
                          <ol className="list-none space-y-2">
                            {(() => {
                              const stepsData: string[] = Array.isArray(solution.steps) ? solution.steps : [(solution.steps as string) || ''];
                              const validSteps = stepsData
                                .flatMap(s => (s ? String(s).split(/\r?\n/) : []))
                                .map(s => s.trim())
                                .filter(Boolean);
                              
                              if (validSteps.length === 0) return null;
                              
                              return validSteps.map((step, stepIdx) => (
                                <li key={stepIdx} className="flex items-start gap-2 text-sm text-green-900">
                                  <span className="flex-shrink-0 w-5 h-5 bg-green-200 text-green-800 rounded-full flex items-center justify-center font-bold text-[10px] mt-0.5">
                                    {stepIdx + 1}
                                  </span>
                                  <span className="leading-relaxed">{step}</span>
                                </li>
                              ));
                            })()}
                          </ol>
                        </div>
                      </div>
                    ))}

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-900 text-sm">
                        💡 <strong>Apakah ini menyelesaikan masalah Anda?</strong> Jika belum, buat tiket dukungan di bawah dan tim TI kami akan membantu Anda secara langsung.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-6 h-6 text-orange-700" />
                      <h3 className="text-orange-900">Saya tidak menemukan solusi otomatis</h3>
                    </div>

                    {inferenceResult.symptoms.length > 0 && (
                      <div className="p-4 bg-white border border-orange-200 rounded-lg">
                        <p className="text-orange-800 font-medium mb-2">Gejala terdeteksi:</p>
                        <div className="flex flex-wrap gap-2">
                          {inferenceResult.symptoms.map(s => (
                            <Badge key={s.code} variant="outline" className="border-orange-400 text-orange-800">
                              [{s.code}] {s.name}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-orange-700 text-sm mt-3">
                          Kombinasi gejala ini belum memiliki aturan yang sesuai di knowledge base.
                        </p>
                      </div>
                    )}

                    {inferenceResult.symptoms.length === 0 && (
                      <div className="p-4 bg-white border border-orange-200 rounded-lg">
                        <p className="text-orange-800">
                          Masalah Anda belum dapat diidentifikasi secara otomatis. Tim IT Support kami siap membantu!
                        </p>
                      </div>
                    )}

                    <div className="p-5 bg-white border border-orange-300 rounded-lg">
                      <p className="text-orange-900 font-medium mb-3">Yang akan terjadi selanjutnya:</p>
                      <div className="space-y-2">
                        {[
                          'Masalah Anda akan dikirim ke tim Dukungan TI kami',
                          'Teknisi akan meninjau kasus Anda dan merespons',
                          'Anda dapat melacak statusnya di "Tiket Saya"'
                        ].map((step, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">{i + 1}</div>
                            <p className="text-orange-800 text-sm flex-1">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handleCreateTicket}
                      disabled={ticketCreating}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      size="lg"
                    >
                      {ticketCreating ? (
                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Membuat Tiket Dukungan...</>
                      ) : (
                        <><TicketIcon className="w-5 h-5 mr-2" />Buat Tiket Dukungan</>
                      )}
                    </Button>
                  </>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2 pt-4 border-t border-slate-200">
                  {inferenceResult.hasSolution && (
                    <Button onClick={handleCreateTicket} disabled={ticketCreating} variant="outline" className="w-full">
                      {ticketCreating ? 'Membuat tiket...' : 'Solusi tidak membantu? Buat tiket'}
                    </Button>
                  )}
                  <Button onClick={handleReset} variant="ghost" className="w-full">
                    Ajukan Pertanyaan Lain
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== INPUT FORM =====
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-slate-300 shadow-lg">
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="mb-2">IT HELPDESK</h2>
              <p className="text-slate-600">
                Jelaskan masalah dan keluhan IT Anda! Kami akan membantu mencari solusinya menggunakan algoritma Forward Chaining.
              </p>
              {!kbLoaded && !kbError && (
                <div className="flex items-center justify-center gap-2 mt-2 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memuat knowledge base...
                </div>
              )}
              {kbLoaded && (
                <div className="text-green-600 text-sm mt-2">
                  ✓ Knowledge base dimuat: {dbSymptoms.length} gejala, {dbRules.length} aturan, {dbSolutions.length} solusi
                </div>
              )}
              {kbError && (
                <div className="text-red-600 text-sm mt-2">{kbError}</div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Input area */}
            <div className="space-y-3">
              <Textarea
                placeholder="Contoh: Laptop saya tidak bisa menyala dan layarnya menampilkan garis-garis..."
                value={problemText}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setProblemText(e.target.value)}
                rows={6}
                className="resize-none text-base"
                onKeyDown={(e: { key: string; metaKey: boolean; ctrlKey: boolean }) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleAnalyze();
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <p className="text-slate-500 text-sm">Tekan Ctrl+Enter untuk mengirim</p>
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing || !problemText.trim() || !kbLoaded}
                  size="lg"
                  className="min-w-[200px]"
                >
                  {analyzing ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Menganalisis...</>
                  ) : (
                    <><Send className="w-5 h-5 mr-2" />Dapatkan Bantuan</>
                  )}
                </Button>
              </div>
            </div>

            {/* Example prompts */}
            <div className="border-t border-slate-200 pt-6">
              <p className="text-slate-600 mb-3">Coba tanyakan tentang:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  'Laptop saya tidak menyala sama sekali',
                  'Printer tidak terdeteksi dan tidak bisa cetak',
                  'Koneksi WiFi tidak terhubung dan internet terputus',
                  'Laptop hang dan kinerja sangat lambat',
                  'Aplikasi Accurate tidak bisa dibuka',
                  'Speaker Bluetooth tidak terkoneksi',
                ].map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => setProblemText(example)}
                    className="text-left p-3 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <p className="text-slate-700 text-sm">{example}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
