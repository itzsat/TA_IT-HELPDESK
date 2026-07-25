import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Edit2, Trash2, Book, Lightbulb, ListTree, AlertCircle } from 'lucide-react';
import { supabaseAdmin } from '../utils/supabase/adminClient';

interface KnowledgeBaseManagerProps {
  accessToken: string;
}

interface Rule {
  id: string;
  code: string;
  damage_code: string;
  symptom_codes: string[];
  confidence: number;
}

interface Solution {
  id: string;
  code: string;
  damage_code: string;
  description: string;
  steps: string[];
}

interface Damage {
  code: string;
  name: string;
  description: string;
}

interface Symptom {
  code: string;
  name: string;
  category: string;
}

export function KnowledgeBaseManager({ accessToken }: KnowledgeBaseManagerProps) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [damages, setDamages] = useState<Damage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Rule form
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [ruleConditions, setRuleConditions] = useState('');
  const [ruleConclusionCode, setRuleConclusionCode] = useState('');
  const [ruleConfidence, setRuleConfidence] = useState('0.8');

  // Solution form
  const [solutionDialogOpen, setSolutionDialogOpen] = useState(false);
  const [editingSolution, setEditingSolution] = useState<Solution | null>(null);
  const [solutionProblemCode, setSolutionProblemCode] = useState('');
  const [solutionTitle, setSolutionTitle] = useState('');
  const [solutionSteps, setSolutionSteps] = useState('');

  // Symptom form
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [symptomDialogOpen, setSymptomDialogOpen] = useState(false);
  const [editingSymptom, setEditingSymptom] = useState<Symptom | null>(null);
  const [symptomName, setSymptomName] = useState('');
  const [symptomCategory, setSymptomCategory] = useState('');

  // Damage form
  const [damageDialogOpen, setDamageDialogOpen] = useState(false);
  const [editingDamage, setEditingDamage] = useState<Damage | null>(null);
  const [damageName, setDamageName] = useState('');
  const [damageDescription, setDamageDescription] = useState('');

  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  const fetchKnowledgeBase = async () => {
    setLoading(true);
    try {
      const [rulesRes, solutionsRes, damagesRes, symptomsRes] = await Promise.all([
        supabaseAdmin.from('rules').select('*'),
        supabaseAdmin.from('solutions').select('*'),
        supabaseAdmin.from('damages').select('*'),
        supabaseAdmin.from('symptoms').select('*')
      ]);

      if (rulesRes.error) throw new Error(rulesRes.error.message);
      if (solutionsRes.error) throw new Error(solutionsRes.error.message);
      if (damagesRes.error) throw new Error(damagesRes.error.message);
      if (symptomsRes.error) throw new Error(symptomsRes.error.message);

      setRules(rulesRes.data as Rule[]);
      setSolutions(solutionsRes.data as Solution[]);
      setDamages(damagesRes.data as Damage[]);
      setSymptoms(symptomsRes.data as Symptom[]);
      setError('');
    } catch (err: any) {
      console.error('Error fetching knowledge base:', err);
      setError(err.message || 'Failed to fetch knowledge base');
    } finally {
      setLoading(false);
    }
  };

  // ===== SYMPTOM MANAGEMENT =====
  const handleSaveSymptom = async () => {
    try {
      if (editingSymptom) {
        const { error: dbErr } = await supabaseAdmin
          .from('symptoms')
          .update({ name: symptomName, category: symptomCategory || 'Other' })
          .eq('code', editingSymptom.code);
        if (dbErr) throw new Error(dbErr.message);
      } else {
        const { error: dbErr } = await supabaseAdmin
          .from('symptoms')
          .insert({ code: `G_${Date.now()}`, name: symptomName, category: symptomCategory || 'Other' });
        if (dbErr) throw new Error(dbErr.message);
      }
      await fetchKnowledgeBase();
      setSymptomDialogOpen(false);
      resetSymptomForm();
    } catch (err: any) {
      console.error('Error saving symptom:', err);
      setError(err.message || 'Failed to save symptom');
    }
  };

  const handleDeleteSymptom = async (code: string) => {
    if (!confirm('Hapus gejala ini?')) return;
    try {
      const { error: dbErr } = await supabaseAdmin.from('symptoms').delete().eq('code', code);
      if (dbErr) throw new Error(dbErr.message);
      await fetchKnowledgeBase();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus gejala');
    }
  };

  const openEditSymptom = (symptom: Symptom) => {
    setEditingSymptom(symptom);
    setSymptomName(symptom.name);
    setSymptomCategory(symptom.category);
    setSymptomDialogOpen(true);
  };

  const resetSymptomForm = () => {
    setEditingSymptom(null);
    setSymptomName('');
    setSymptomCategory('');
  };

  // ===== DAMAGE MANAGEMENT =====
  const handleSaveDamage = async () => {
    try {
      if (editingDamage) {
        const { error: dbErr } = await supabaseAdmin
          .from('damages')
          .update({ name: damageName, description: damageDescription })
          .eq('code', editingDamage.code);
        if (dbErr) throw new Error(dbErr.message);
      } else {
        const { error: dbErr } = await supabaseAdmin
          .from('damages')
          .insert({ code: `K_${Date.now()}`, name: damageName, description: damageDescription });
        if (dbErr) throw new Error(dbErr.message);
      }
      await fetchKnowledgeBase();
      setDamageDialogOpen(false);
      resetDamageForm();
    } catch (err: any) {
      console.error('Error saving damage:', err);
      setError(err.message || 'Failed to save damage');
    }
  };

  const handleDeleteDamage = async (code: string) => {
    if (!confirm('Hapus masalah ini? Hati-hati, aturan dan solusi yang merujuk pada masalah ini bisa bermasalah.')) return;
    try {
      const { error: dbErr } = await supabaseAdmin.from('damages').delete().eq('code', code);
      if (dbErr) throw new Error(dbErr.message);
      await fetchKnowledgeBase();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus masalah');
    }
  };

  const openEditDamage = (damage: Damage) => {
    setEditingDamage(damage);
    setDamageName(damage.name);
    setDamageDescription(damage.description);
    setDamageDialogOpen(true);
  };

  const resetDamageForm = () => {
    setEditingDamage(null);
    setDamageName('');
    setDamageDescription('');
  };

  // ===== RULE MANAGEMENT =====
  const handleSaveRule = async () => {
    try {
      const symptom_codes = ruleConditions.split(',').map(c => c.trim()).filter(c => c);
      if (editingRule) {
        const { error: dbErr } = await supabaseAdmin
          .from('rules')
          .update({ symptom_codes, damage_code: ruleConclusionCode, confidence: parseFloat(ruleConfidence) })
          .eq('code', editingRule.code);
        if (dbErr) throw new Error(dbErr.message);
      } else {
        const { error: dbErr } = await supabaseAdmin
          .from('rules')
          .insert({ code: `RULE_${Date.now()}`, symptom_codes, damage_code: ruleConclusionCode, confidence: parseFloat(ruleConfidence) });
        if (dbErr) throw new Error(dbErr.message);
      }
      await fetchKnowledgeBase();
      setRuleDialogOpen(false);
      resetRuleForm();
    } catch (err: any) {
      console.error('Error saving rule:', err);
      setError(err.message || 'Failed to save rule');
    }
  };

  const handleDeleteRule = async (code: string) => {
    if (!confirm('Hapus aturan ini?')) return;
    try {
      const { error: dbErr } = await supabaseAdmin.from('rules').delete().eq('code', code);
      if (dbErr) throw new Error(dbErr.message);
      await fetchKnowledgeBase();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus aturan');
    }
  };

  const openEditRule = (rule: Rule) => {
    setEditingRule(rule);
    setRuleConditions(rule.symptom_codes.join(', '));
    setRuleConclusionCode(rule.damage_code);
    setRuleConfidence(rule.confidence.toString());
    setRuleDialogOpen(true);
  };

  const resetRuleForm = () => {
    setEditingRule(null);
    setRuleConditions('');
    setRuleConclusionCode('');
    setRuleConfidence('0.8');
  };

  // ===== SOLUTION MANAGEMENT =====
  const handleSaveSolution = async () => {
    try {
      const stepsArray = solutionSteps.split('\n').map(s => s.trim()).filter(s => s);
      if (editingSolution) {
        const { error: dbErr } = await supabaseAdmin
          .from('solutions')
          .update({ damage_code: solutionProblemCode, description: solutionTitle, steps: stepsArray })
          .eq('code', editingSolution.code);
        if (dbErr) throw new Error(dbErr.message);
      } else {
        const { error: dbErr } = await supabaseAdmin
          .from('solutions')
          .insert({ code: `SOL_${Date.now()}`, damage_code: solutionProblemCode, description: solutionTitle, steps: stepsArray });
        if (dbErr) throw new Error(dbErr.message);
      }
      await fetchKnowledgeBase();
      setSolutionDialogOpen(false);
      resetSolutionForm();
    } catch (err: any) {
      console.error('Error saving solution:', err);
      setError(err.message || 'Failed to save solution');
    }
  };

  const handleDeleteSolution = async (code: string) => {
    if (!confirm('Hapus solusi ini?')) return;
    try {
      const { error: dbErr } = await supabaseAdmin.from('solutions').delete().eq('code', code);
      if (dbErr) throw new Error(dbErr.message);
      await fetchKnowledgeBase();
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus solusi');
    }
  };

  const openEditSolution = (solution: Solution) => {
    setEditingSolution(solution);
    setSolutionProblemCode(solution.damage_code);
    setSolutionTitle(solution.description);
    setSolutionSteps(Array.isArray(solution.steps) ? solution.steps.join('\n') : '');
    setSolutionDialogOpen(true);
  };

  const resetSolutionForm = () => {
    setEditingSolution(null);
    setSolutionProblemCode('');
    setSolutionTitle('');
    setSolutionSteps('');
  };

  const getDamageName = (code: string) => {
    const damage = damages.find(d => d.code === code);
    return damage ? damage.name : code;
  };

  // ===== SHARED STYLES =====
  const selectClass = "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">Memuat basis pengetahuan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Page Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Knowledge Base Manager</h2>
        <p className="text-sm text-slate-500 mt-0.5">Kelola seluruh basis pengetahuan sistem pakar Forward Chaining</p>
      </div>

      {/* Stat Cards - clean white like reference */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 mb-4">Gejala</p>
          <p className="text-3xl font-bold text-blue-600">{symptoms.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 mb-4">Masalah</p>
          <p className="text-3xl font-bold text-rose-600">{damages.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 mb-4">Aturan</p>
          <p className="text-3xl font-bold text-amber-500">{rules.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500 mb-4">Solusi</p>
          <p className="text-3xl font-bold text-emerald-600">{solutions.length}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <Tabs defaultValue="symptoms" className="w-full">
        <TabsList className="w-full flex flex-row h-auto bg-slate-100 rounded-xl p-1 mb-6 gap-1">
          <TabsTrigger value="symptoms" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-all">
            <Book className="w-4 h-4" />
            <span>Gejala</span>
            <span className="text-blue-600 text-xs font-bold">{symptoms.length}</span>
          </TabsTrigger>
          <TabsTrigger value="damages" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-all">
            <AlertCircle className="w-4 h-4" />
            <span>Masalah</span>
            <span className="text-rose-600 text-xs font-bold">{damages.length}</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-all">
            <ListTree className="w-4 h-4" />
            <span>Aturan</span>
            <span className="text-amber-600 text-xs font-bold">{rules.length}</span>
          </TabsTrigger>
          <TabsTrigger value="solutions" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium rounded-lg transition-all">
            <Lightbulb className="w-4 h-4" />
            <span>Solusi</span>
            <span className="text-emerald-600 text-xs font-bold">{solutions.length}</span>
          </TabsTrigger>
        </TabsList>

        {/* ========== SYMPTOMS TAB ========== */}
        <TabsContent value="symptoms" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Daftar Gejala</h3>
              <p className="text-sm text-slate-500">Keluhan yang dapat dikenali oleh mesin inferensi</p>
            </div>
            <Dialog open={symptomDialogOpen} onOpenChange={(open: boolean) => { setSymptomDialogOpen(open); if (!open) resetSymptomForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm gap-2">
                  <Plus className="w-4 h-4" /> Tambah Gejala
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Book className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <DialogTitle className="text-base">{editingSymptom ? 'Edit Gejala' : 'Tambah Gejala Baru'}</DialogTitle>
                      <DialogDescription className="text-xs">Daftarkan keluhan spesifik ke basis pengetahuan.</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Nama Gejala</Label>
                    <Input placeholder="Contoh: Lagu indonesia raya tidak terputar" value={symptomName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSymptomName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Kategori <span className="font-normal text-slate-400 normal-case">(opsional)</span></Label>
                    <Input placeholder="Contoh: Software, Hardware, Jaringan" value={symptomCategory} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSymptomCategory(e.target.value)} />
                  </div>
                  <Button onClick={handleSaveSymptom} className="w-full bg-blue-600 hover:bg-blue-700" disabled={!symptomName}>
                    {editingSymptom ? 'Simpan Perubahan' : 'Simpan Gejala Baru'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {symptoms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <Book className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Belum ada gejala terdaftar</p>
              <p className="text-slate-400 text-sm">Tambahkan gejala pertama Anda di atas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {symptoms.map((s) => (
                <div key={s.code} className="group relative p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{s.code}</span>
                        {s.category && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{s.category}</span>}
                      </div>
                      <p className="text-sm font-medium text-slate-800 leading-snug">{s.name}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => openEditSymptom(s)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteSymptom(s.code)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========== DAMAGES TAB ========== */}
        <TabsContent value="damages" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Daftar Masalah / Kerusakan</h3>
              <p className="text-sm text-slate-500">Jenis kerusakan yang menjadi kesimpulan sistem pakar</p>
            </div>
            <Dialog open={damageDialogOpen} onOpenChange={(open: boolean) => { setDamageDialogOpen(open); if (!open) resetDamageForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm gap-2">
                  <Plus className="w-4 h-4" /> Tambah Masalah
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <DialogTitle className="text-base">{editingDamage ? 'Edit Masalah' : 'Tambah Masalah Baru'}</DialogTitle>
                      <DialogDescription className="text-xs">Daftarkan jenis kerusakan untuk sistem pakar.</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Nama Masalah</Label>
                    <Input placeholder="Contoh: Kerusakan Audio Software" value={damageName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDamageName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Deskripsi</Label>
                    <Textarea placeholder="Jelaskan masalah ini..." value={damageDescription} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDamageDescription(e.target.value)} rows={2} />
                  </div>
                  <Button onClick={handleSaveDamage} className="w-full bg-blue-600 hover:bg-blue-700" disabled={!damageName}>
                    {editingDamage ? 'Simpan Perubahan' : 'Simpan Masalah Baru'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {damages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Belum ada masalah terdaftar</p>
              <p className="text-slate-400 text-sm">Tambahkan masalah pertama Anda di atas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {damages.map((d) => (
                <div key={d.code} className="group rounded-xl overflow-hidden border border-rose-100 hover:shadow-md transition-all">
                  <div className="bg-rose-50 px-4 pt-4 pb-3 flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-[10px] bg-white text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded inline-block mb-2">{d.code}</span>
                      <h4 className="font-bold text-rose-900 text-sm mb-1">{d.name}</h4>
                      {d.description && <p className="text-xs text-rose-700 leading-relaxed line-clamp-2">{d.description}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3 flex-shrink-0">
                      <button onClick={() => openEditDamage(d)} className="p-1.5 rounded-lg hover:bg-white text-rose-300 hover:text-blue-600 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteDamage(d.code)} className="p-1.5 rounded-lg hover:bg-white text-rose-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-white px-4 py-2.5 flex items-center gap-3">
                    <span className="text-xs font-medium text-rose-600">{solutions.filter(s => s.damage_code === d.code).length} solusi</span>
                    <span className="text-rose-200">•</span>
                    <span className="text-xs font-medium text-amber-600">{rules.filter(r => r.damage_code === d.code).length} aturan</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========== RULES TAB ========== */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Aturan Inferensi</h3>
              <p className="text-sm text-slate-500">Logika IF-THEN untuk mesin Forward Chaining</p>
            </div>
            <Dialog open={ruleDialogOpen} onOpenChange={(open: boolean) => { setRuleDialogOpen(open); if (!open) resetRuleForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm gap-2">
                  <Plus className="w-4 h-4" /> Tambah Aturan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <ListTree className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <DialogTitle className="text-base">{editingRule ? 'Edit Aturan' : 'Tambah Aturan Baru'}</DialogTitle>
                      <DialogDescription className="text-xs">Hubungkan gejala dengan kesimpulan masalah.</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">IF — Gejala (pilih satu atau lebih)</Label>
                    <p className="text-xs text-slate-400">Tahan Ctrl/Cmd untuk memilih lebih dari satu gejala.</p>
                    <select
                      multiple
                      className={selectClass + " focus:ring-amber-400 focus:border-amber-400"}
                      style={{ minHeight: '130px' }}
                      value={ruleConditions ? ruleConditions.split(',').map(c => c.trim()).filter(c => c) : []}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                        setRuleConditions(selected.join(', '));
                      }}
                    >
                      {symptoms.map((s) => (
                        <option key={s.code} value={s.code}>[{s.code}] {s.name}</option>
                      ))}
                    </select>
                    {ruleConditions && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ruleConditions.split(',').map(c => c.trim()).filter(c => c).map(code => {
                          const sym = symptoms.find(s => s.code === code);
                          return <span key={code} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{sym ? sym.name : code}</span>;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">THEN — Masalah (Kesimpulan)</Label>
                    <select className={selectClass + " focus:ring-amber-400 focus:border-amber-400"} value={ruleConclusionCode} onChange={(e) => setRuleConclusionCode(e.target.value)}>
                      <option value="">Pilih Masalah / Kerusakan...</option>
                      {damages.map((d) => (
                        <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Nilai Kepercayaan (0.0 – 1.0)</Label>
                    <div className="flex items-center gap-3">
                      <Input type="number" step="0.1" min="0" max="1" value={ruleConfidence} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRuleConfidence(e.target.value)} className="w-28" />
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${parseFloat(ruleConfidence || '0') * 100}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-amber-600">{Math.round(parseFloat(ruleConfidence || '0') * 100)}%</span>
                    </div>
                  </div>
                  <Button onClick={handleSaveRule} className="w-full bg-blue-600 hover:bg-blue-700">
                    {editingRule ? 'Simpan Perubahan' : 'Simpan Aturan Baru'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <ListTree className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Belum ada aturan terdaftar</p>
              <p className="text-slate-400 text-sm">Buat aturan pertama Anda di atas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.code} className="group rounded-xl overflow-hidden border border-amber-100 hover:shadow-md transition-all">
                  <div className="bg-amber-50 px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-amber-400">{rule.code}</span>
                          <span className="text-xs font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">IF</span>
                          <div className="flex flex-wrap gap-1">
                            {rule.symptom_codes?.map((code) => {
                              const sym = symptoms.find(s => s.code === code);
                              return (
                                <span key={code} className="text-xs bg-white text-slate-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                  {sym ? sym.name : code}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pl-3 border-l-2 border-emerald-400">
                          <span className="text-xs font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">THEN</span>
                          <span className="font-bold text-amber-900 text-sm">{getDamageName(rule.damage_code)}</span>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <div className="w-16 h-1.5 bg-amber-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500" style={{ width: `${(rule.confidence || 0.8) * 100}%` }} />
                            </div>
                            <span className="text-xs font-bold text-amber-700 w-8">{((rule.confidence || 0.8) * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-4 flex-shrink-0">
                        <button onClick={() => openEditRule(rule)} className="p-1.5 rounded-lg hover:bg-white text-amber-300 hover:text-blue-600 transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteRule(rule.code)} className="p-1.5 rounded-lg hover:bg-white text-amber-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========== SOLUTIONS TAB ========== */}
        <TabsContent value="solutions" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Daftar Solusi</h3>
              <p className="text-sm text-slate-500">Langkah-langkah penyelesaian untuk setiap masalah</p>
            </div>
            <Dialog open={solutionDialogOpen} onOpenChange={(open: boolean) => { setSolutionDialogOpen(open); if (!open) resetSolutionForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm gap-2">
                  <Plus className="w-4 h-4" /> Tambah Solusi
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <DialogTitle className="text-base">{editingSolution ? 'Edit Solusi' : 'Tambah Solusi Baru'}</DialogTitle>
                      <DialogDescription className="text-xs">Langkah penyelesaian untuk masalah tertentu.</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Masalah yang Diselesaikan</Label>
                    <select className={selectClass + " focus:ring-emerald-400 focus:border-emerald-400"} value={solutionProblemCode} onChange={(e) => setSolutionProblemCode(e.target.value)}>
                      <option value="">Pilih Masalah / Kerusakan...</option>
                      {damages.map((d) => (
                        <option key={d.code} value={d.code}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Judul Solusi</Label>
                    <Input placeholder="Judul solusi..." value={solutionTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSolutionTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Langkah-langkah <span className="font-normal text-slate-400 normal-case">(pisahkan baris baru)</span></Label>
                    <Textarea placeholder={"Langkah 1\nLangkah 2\nLangkah 3"} value={solutionSteps} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSolutionSteps(e.target.value)} rows={5} className="font-mono text-sm" />
                  </div>
                  <Button onClick={handleSaveSolution} className="w-full bg-blue-600 hover:bg-blue-700">
                    {editingSolution ? 'Simpan Perubahan' : 'Simpan Solusi Baru'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {solutions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <Lightbulb className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Belum ada solusi terdaftar</p>
              <p className="text-slate-400 text-sm">Tambahkan solusi pertama Anda di atas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {solutions.map((solution) => (
                <div key={solution.code} className="group rounded-xl overflow-hidden border border-emerald-100 hover:shadow-md transition-all">
                  <div className="bg-emerald-50 px-4 pt-4 pb-3 flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-[10px] bg-white text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded inline-block mb-2">{solution.code}</span>
                      <h4 className="font-bold text-emerald-900 text-sm mb-2 leading-snug">{solution.description}</h4>
                      <span className="text-xs bg-white text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full">
                        {getDamageName(solution.damage_code)}
                      </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3 flex-shrink-0">
                      <button onClick={() => openEditSolution(solution)} className="p-1.5 rounded-lg hover:bg-white text-emerald-300 hover:text-blue-600 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteSolution(solution.code)} className="p-1.5 rounded-lg hover:bg-white text-emerald-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-white border-t border-emerald-100 px-4 py-3">
                    <ol className="list-none space-y-1.5">
                      {(Array.isArray(solution.steps) ? solution.steps : [solution.steps]).map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                          <span className="flex-shrink-0 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-[10px] mt-0.5">{idx + 1}</span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
