
"use client";
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });
const PRIORITY_COLORS = { 0: 'bg-blue-500', 1: 'bg-orange-500', 2: 'bg-red-500' };

export default function HistoryPage() {
    const [history, setHistory] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expandedDate, setExpandedDate] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const hRes = await fetch('/api/history');
                if (hRes.ok) {
                    const h = await hRes.json();
                    setHistory(h);
                } else {
                    console.error("History fetch failed", hRes.status);
                }
            } catch (e) { console.error(e); }

            try {
                const sRes = await fetch('/api/stats');
                if (sRes.ok) {
                    const s = await sRes.json();
                    setStats(s);
                }
            } catch (e) { console.error(e); }

            setLoading(false);
        }
        loadData();
    }, []);

    if (loading) return <div className="flex h-screen items-center justify-center text-gray-400 animate-pulse bg-[#F0F4F8]">Loading...</div>;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-40">
            <header className="mb-10 pt-2">
                <p className="text-gray-500 font-bold text-sm uppercase tracking-widest mb-1">Execution Log</p>
                <h1 className={cn("text-5xl font-extrabold text-gray-900 tracking-tight", outfit.className)}>History</h1>
            </header>

            {/* WEEKLY REALITY CHECK CARD */}
            <div className="bg-black text-white rounded-[2rem] p-8 mb-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11V5h-2v6h-4v2h4v6h2v-6h4v-2h-4z" /></svg>
                </div>
                <div className="relative z-10">
                    <h2 className={cn("text-xl font-bold mb-6 text-gray-200", outfit.className)}>Weekly Reality Check (Last 7 Days)</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">DSA Days</p>
                            <p className="text-4xl font-extrabold">{stats?.dsa_problems || 0}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Gym Days</p>
                            <p className="text-4xl font-extrabold">{stats?.gym_days || 0}</p>
                        </div>
                        <div>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Dev Days</p>
                            <p className="text-4xl font-extrabold">{stats?.dev_days || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6">
                {history.map((day) => {
                    const completedCount = day.tasks ? day.tasks.filter((t: any) => t.completed).length : 0;
                    const totalCount = day.tasks ? day.tasks.length : 0;
                    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                    const isExpanded = expandedDate === day.date;

                    // Status Border Logic
                    let statusBorder = "border-gray-100";
                    if (completedCount <= 1) statusBorder = "border-red-200 bg-red-50/10";
                    else if (completedCount === 2) statusBorder = "border-yellow-200 bg-yellow-50/10";
                    else if (completedCount >= 3) statusBorder = "border-green-200 bg-green-50/10";

                    return (
                        <div key={day.date} className="group">
                            <div
                                onClick={() => setExpandedDate(isExpanded ? null : day.date)}
                                className={cn(
                                    "rounded-3xl border shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden relative transition-all duration-300 cursor-pointer",
                                    statusBorder,
                                    isExpanded ? "bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] scale-[1.01] ring-1 ring-gray-200" : "bg-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)]"
                                )}
                            >
                                <div className="p-6 md:p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className={cn("font-bold text-2xl text-gray-900 tracking-tight mb-1", outfit.className)}>
                                                {new Date(day.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'long' })}
                                            </h3>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-md">
                                                    <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-black rounded-full" style={{ width: `${progress}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-600">{Math.round(progress)}%</span>
                                                </div>

                                            </div>
                                        </div>

                                        {/* Status Dots */}
                                        <div className="flex gap-1.5 flex-wrap max-w-[120px] justify-end content-start">
                                            {day.tasks && day.tasks.slice(0, 10).map((t: any) => (
                                                <div
                                                    key={t.id}
                                                    className={cn(
                                                        "w-2 h-2 rounded-full transition-all",
                                                        t.completed ? (PRIORITY_COLORS[t.priority as 0 | 1 | 2] || 'bg-green-500') : "bg-gray-200 scale-75"
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {!isExpanded ? (
                                        <p className="text-gray-400 font-medium truncate opacity-70">{day.note || "No reflection tracked."}</p>
                                    ) : (
                                        <div className="animate-in fade-in duration-500">
                                            {day.note && (
                                                <div className="mb-6 p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                                                    <p className="text-gray-800 text-lg leading-relaxed font-medium whitespace-pre-wrap">
                                                        "{day.note}"
                                                    </p>
                                                </div>
                                            )}

                                            {day.tomorrow_intent && (
                                                <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                                                    <span className="text-xl">🎯</span>
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Intent for Next Day</p>
                                                        <p className="text-gray-900 font-bold">{day.tomorrow_intent}</p>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-4">
                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Tasks Log</h4>
                                                {day.tasks && day.tasks.map((t: any) => (
                                                    <div key={t.id} className="flex items-start gap-3 group/item">
                                                        <div className={cn(
                                                            "mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                                            t.completed ? "bg-black border-black" : "border-gray-200"
                                                        )}>
                                                            {t.completed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className={cn("text-base font-medium transition-colors", t.completed ? "text-gray-900" : "text-gray-500")}>
                                                                {t.title}
                                                            </p>
                                                            {t.note && <p className="text-sm text-gray-400 mt-0.5">{t.note}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
