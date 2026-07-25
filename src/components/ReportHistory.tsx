import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { supabaseAdmin } from '../utils/supabase/adminClient';
import { User } from '../App';
interface ReportHistoryProps {
  accessToken: string;
  user: User;
}

interface Report {
  id: string;
  symptoms: string[];
  description: string;
  inferenceResult: any;
  hasSolution: boolean;
  createdAt: string;
  status: string;
}

export function ReportHistory({ accessToken, user }: ReportHistoryProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data, error: dbErr } = await supabaseAdmin
        .from('kv_store_688b6236')
        .select('*')
        .like('key', 'report_%');

      if (dbErr) throw new Error(dbErr.message);

      let parsed = (data || []).map(row => row.value as Report);
      // Filter by current user
      parsed = parsed.filter(r => (r as any).userId === user.id || !(r as any).userId);
      parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setReports(parsed);
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      if (!silent) setError(err.message || 'Failed to fetch reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  useEffect(() => {
    fetchReports();
    // Poll every 30 seconds to pick up status updates
    intervalRef.current = setInterval(() => fetchReports(true), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchReports]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Memuat riwayat laporan...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Riwayat Laporan</CardTitle>
          <CardDescription>
            Lihat laporan masalah Anda sebelumnya dan penyelesaiannya
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchReports(true)}
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Memperbarui...' : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Belum ada laporan</p>
            <p className="text-slate-500 mt-2">
              Laporan masalah Anda akan muncul di sini
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-slate-50"
                  onClick={() =>
                    setExpandedReport(
                      expandedReport === report.id ? null : report.id
                    )
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {report.hasSolution ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-orange-600" />
                        )}
                        <Badge
                          className={
                            report.status === 'resolved_auto'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }
                        >
                          {report.status === 'resolved_auto'
                            ? 'Terselesaikan Otomatis'
                            : 'Perlu Tinjauan Manual'}
                        </Badge>
                        <span className="text-slate-500">
                          {formatDate(report.createdAt)}
                        </span>
                      </div>
                      <p className="text-slate-900 mb-1">
                        Laporan Masalah #{report.id.split('_')[1]}
                      </p>
                      {report.description && (
                        <p className="text-slate-600 line-clamp-2">
                          {report.description}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm">
                      {expandedReport === report.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {expandedReport === report.id && (
                  <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-4">
                    <div>
                      <h5 className="text-slate-900 mb-2">Gejala yang Dilaporkan:</h5>
                      <div className="flex flex-wrap gap-2">
                        {report.symptoms.map((symptom) => (
                          <Badge key={symptom} variant="outline">
                            {symptom.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Identified damages with CF */}
                    {(report.inferenceResult?.damages?.length > 0) && (
                      <div>
                        <h5 className="text-slate-900 mb-2">Masalah yang Teridentifikasi:</h5>
                        <div className="flex flex-wrap gap-2">
                          {report.inferenceResult.damages.map(
                            (dmg: any, idx: number) => (
                              <Badge key={idx} className="bg-purple-600">
                                {dmg.name || dmg.code}
                                {dmg.confidence ? ` (${(dmg.confidence * 100).toFixed(0)}%)` : ''}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Solutions */}
                    {(report.inferenceResult?.solutions?.length > 0) && (
                      <div>
                        <h5 className="text-slate-900 mb-2">Solusi yang Diberikan:</h5>
                        <div className="space-y-2">
                          {report.inferenceResult.solutions.map(
                            (solution: any, idx: number) => (
                              <div
                                key={solution.id || idx}
                                className="p-3 bg-white border border-slate-200 rounded"
                              >
                                <p className="text-slate-900 font-medium">{solution.description || solution.title || `Solusi ${idx + 1}`}</p>
                                {Array.isArray(solution.steps) && solution.steps.length > 0 && (
                                  <ol className="list-decimal pl-4 mt-2 space-y-1">
                                    {solution.steps.slice(0, 3).map((step: string, si: number) => (
                                      <li key={si} className="text-slate-600 text-sm">{step}</li>
                                    ))}
                                    {solution.steps.length > 3 && (
                                      <li className="text-slate-400 text-sm">+{solution.steps.length - 3} langkah lainnya...</li>
                                    )}
                                  </ol>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {!report.hasSolution && (
                      <Alert>
                        <AlertDescription>
                          Tidak ditemukan solusi otomatis. Tiket dukungan mungkin
                          telah dibuat.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
