
"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { SelectTime } from '@/components/SelectTime';
import { TaskItem } from '@/components/TaskItem';
import { cn } from '@/lib/utils';
import { Outfit } from 'next/font/google';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const outfit = Outfit({ subsets: ['latin'] });
const PRIORITY_LABELS = { 0: 'LOW', 1: 'MED', 2: 'HIGH' };

const getTodayStr = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

export default function TodayPage() {
    const [date] = useState(getTodayStr());
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Dialogs
    const [addingType, setAddingType] = useState<null | 'task' | 'habit' | 'section' | 'rule'>(null);
    const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
    const [isRulesExpanded, setIsRulesExpanded] = useState(false);
    const [isWorkoutExpanded, setIsWorkoutExpanded] = useState(false);

    // Inputs
    const [newItemTitle, setNewItemTitle] = useState('');
    const [newItemPriority, setNewItemPriority] = useState(1);
    const [newSectionTitle, setNewSectionTitle] = useState('');
    const [newRuleContent, setNewRuleContent] = useState('');

    const fetchData = useCallback(() => {
        fetch(`/api/daily?date=${date}`)
            .then(r => r.json())
            .then(d => {
                setData(d);
                setLoading(false);
            });
    }, [date]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const saveSummary = useCallback(async (newDataSummary: any) => {
        setSaving(true);
        setData((prev: any) => ({ ...prev, ...newDataSummary }));
        await fetch('/api/daily', { method: 'POST', body: JSON.stringify({ date, ...newDataSummary }) });
        setSaving(false);
    }, [date]);

    // Create Logic for various types...
    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemTitle.trim()) return;

        const type = addingType === 'habit' ? 'habit' : 'task';
        const sectionId = activeSectionId;

        const payload = {
            date,
            title: newItemTitle,
            priority: newItemPriority,
            type,
            section_id: sectionId
        };

        setNewItemTitle('');
        setAddingType(null);
        setActiveSectionId(null);

        toast.promise(fetch('/api/tasks', { method: 'POST', body: JSON.stringify(payload) }).then(async r => { if (!r.ok) throw new Error(); fetchData(); }), {
            loading: 'Creating...',
            success: 'Added successfully',
            error: 'Failed to add'
        });
    };

    const handleCreateSection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSectionTitle.trim()) return;
        toast.promise(fetch('/api/sections', { method: 'POST', body: JSON.stringify({ title: newSectionTitle }) }).then(async r => { if (!r.ok) throw new Error(); setNewSectionTitle(''); setAddingType(null); fetchData(); }), {
            loading: 'Creating Section...', success: 'Section created', error: 'Failed'
        });
    };

    const handleCreateRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRuleContent.trim()) return;
        toast.promise(fetch('/api/rules', { method: 'POST', body: JSON.stringify({ content: newRuleContent }) }).then(async r => { if (!r.ok) throw new Error(); setNewRuleContent(''); fetchData(); }), {
            loading: 'Adding Rule...', success: 'Rule remembered', error: 'Failed'
        });
    };

    const handleDeleteRule = async (id: number) => {
        await fetch('/api/rules', { method: 'DELETE', body: JSON.stringify({ id }) });
        fetchData();
    };

    const handleDeleteSection = async (id: number) => {
        if (!confirm('Delete this section? Tasks will move to General.')) return;
        await fetch('/api/sections', { method: 'DELETE', body: JSON.stringify({ id }) });
        fetchData();
        toast.success('Section deleted');
    };

    const handleToggle = async (id: number, completed: boolean) => {
        setData((d: any) => ({
            ...d,
            tasks: d.tasks.map((t: any) => t.id === id ? { ...t, completed: completed ? 1 : 0 } : t)
        }));
        await fetch('/api/tasks', { method: 'PATCH', body: JSON.stringify({ id, completed }) });
    };

    const handleUpdateNote = async (id: number, note: string) => {
        await fetch('/api/tasks', { method: 'PATCH', body: JSON.stringify({ id, note }) });
    };

    const handleDelete = async (id: number, isHabit: boolean, habitId?: number) => {
        if (isHabit) {
            if (!confirm('Remove this habit routine?')) return;
            await fetch('/api/tasks', { method: 'DELETE', body: JSON.stringify({ id: habitId, is_habit_template: true }) });
            toast.success('Habit archived');
        } else {
            await fetch('/api/tasks', { method: 'DELETE', body: JSON.stringify({ id, is_habit_template: false }) });
            toast.success('Task deleted');
        }
        fetchData();
    };

    if (loading || !data) return <div className="flex h-screen items-center justify-center text-gray-400 animate-pulse bg-[#F0F4F8]">Loading...</div>;

    // Grouping
    const habits = data.tasks.filter((t: any) => t.habit_id !== null);
    const allOneOffs = data.tasks.filter((t: any) => t.habit_id === null);
    const generalTasks = allOneOffs.filter((t: any) => !t.section_id);
    const sections: any[] = data.sections || [];
    const rules: any[] = data.rules || [];

    // Completion Calculation
    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter((t: any) => t.completed).length;

    // Workout Data
    const WORKOUT_SCHEDULE = [
        { day: 'Sunday', split: 'Rest / Recovery', run: 'No run. Rest is part of the system.' },
        { day: 'Monday', split: 'Chest + Core', run: '2 km easy' },
        { day: 'Tuesday', split: 'Back + Grip', run: '2 km easy' },
        { day: 'Wednesday', split: 'Shoulders + Triceps', run: '2 km easy' },
        { day: 'Thursday', split: 'Biceps + Forearms', run: '2 km easy' },
        { day: 'Friday', split: 'Full Body Power (Athletic)', run: 'Light jog / conditioning' },
        { day: 'Saturday', split: 'Legs', run: 'Skip or very light' },
    ];

    const currentDayIndex = new Date().getDay();
    const todayWorkout = WORKOUT_SCHEDULE.find((_, i) => i === currentDayIndex);

    let statusColor = "bg-gray-100 text-gray-500 border-gray-200";
    if (completedTasks <= 1) statusColor = "bg-red-50 text-red-600 border-red-100";
    else if (completedTasks === 2) statusColor = "bg-yellow-50 text-yellow-700 border-yellow-100";
    else if (completedTasks >= 3) statusColor = "bg-green-50 text-green-700 border-green-100";

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-32">

            {/* --- CARD 1: FOCUS & PROGRESS --- */}
            <div className="flex flex-col md:flex-row gap-6 mb-8 items-stretch">
                <div className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm flex-1 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-1">
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </p>
                            <h1 className={cn("text-3xl font-extrabold text-gray-900", outfit.className)}>
                                {todayWorkout?.split.includes('Rest') ? 'Rest & Recovery' : 'Execution Mode'}
                            </h1>
                        </div>
                        <div className={cn("px-3 py-1 rounded-lg border text-xs font-black uppercase tracking-wider", statusColor)}>
                            {completedTasks} / {Math.max(5, totalTasks)}
                        </div>
                    </div>

                    {/* Visual Progress (Blocks) */}
                    <div className="flex gap-1.5 mb-2">
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "h-2 flex-1 rounded-full transition-all duration-500",
                                    i < completedTasks ? "bg-black" : "bg-gray-100"
                                )}
                            />
                        ))}
                    </div>
                    <p className="text-xs text-gray-400 font-medium text-right mt-1">Daily Target: 5 Items</p>
                </div>

                {/* --- CARD 4: REFERENCE (Collapsed) --- */}
                <div className="flex flex-col gap-2 justify-center">
                    <button
                        onClick={() => setIsWorkoutExpanded(!isWorkoutExpanded)}
                        className={cn(
                            "border font-bold px-5 py-3 rounded-2xl text-sm transition-all flex items-center gap-2",
                            isWorkoutExpanded
                                ? "bg-black text-white border-black hover:bg-gray-800"
                                : "bg-white border-gray-200 text-gray-600 hover:border-black hover:bg-gray-50"
                        )}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        Workout
                    </button>
                    <button
                        onClick={() => setIsRulesExpanded(!isRulesExpanded)}
                        className={cn(
                            "border font-bold px-5 py-3 rounded-2xl text-sm transition-all flex items-center gap-2",
                            isRulesExpanded
                                ? "bg-black text-white border-black hover:bg-gray-800"
                                : "bg-white border-gray-200 text-gray-600 hover:border-black hover:bg-gray-50"
                        )}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Principles
                    </button>
                    <button
                        onClick={() => setAddingType('section')}
                        className="bg-gray-100 border border-transparent hover:bg-white hover:border-gray-200 text-gray-500 font-bold px-5 py-3 rounded-2xl text-sm transition-all text-center"
                    >
                        + Company
                    </button>
                </div>
            </div>

            {/* EXPANDABLE AREAS */}
            <AnimatePresence>
                {isWorkoutExpanded && (
                    <motion.div
                        key="workout-panel"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-6"
                    >
                        <div className="bg-gray-900 text-white rounded-[2rem] p-8 relative shadow-xl">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Weekly Workout Reference</h4>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest border border-gray-700 px-2 py-1 rounded">Reference Only</span>
                            </div>
                            <div className="space-y-3">
                                {WORKOUT_SCHEDULE.map((w, idx) => {
                                    const isToday = idx === currentDayIndex;
                                    return (
                                        <div key={w.day} className={cn("flex items-center justify-between p-4 rounded-xl transition-all border", isToday ? "bg-white text-black font-bold border-white scale-[1.02] shadow-lg" : "text-gray-400 border-gray-800 hover:bg-gray-800/50")}>
                                            <div className="flex items-center gap-4">
                                                <div className={cn("text-xs uppercase w-24 tracking-wider", isToday ? "font-black" : "font-bold opacity-50")}>{w.day}</div>
                                                <div className="text-base">{w.split}</div>
                                            </div>
                                            <div className="text-xs text-right opacity-80 pl-4 border-l border-gray-500/30 ml-4 min-w-[120px] font-mono">
                                                🏃 {w.run}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-center text-gray-600 text-xs mt-6 font-medium">This is a reference, not a requirement.</p>
                        </div>
                    </motion.div>
                )}
                {isRulesExpanded && (
                    <motion.div
                        key="rules-panel"
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-8"
                    >
                        <div className="bg-yellow-50 border border-yellow-100 rounded-[2rem] p-8 relative">
                            <h4 className="text-xs font-black text-yellow-800 uppercase tracking-widest mb-4">Core Principles</h4>
                            <ul className="space-y-3 mb-6">
                                {rules.map(r => (
                                    <li key={r.id || `rule-${Math.random()}`} className="text-sm font-bold text-gray-800 flex items-start gap-3 group">
                                        <span className="text-yellow-500 mt-1">•</span>
                                        <span className="flex-1">{r.content}</span>
                                        <button onClick={() => handleDeleteRule(r.id)} className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                    </li>
                                ))}
                            </ul>
                            <form onSubmit={handleCreateRule} className="flex gap-2">
                                <input
                                    className="bg-white border-none rounded-xl text-sm p-3 font-medium flex-1 focus:ring-2 focus:ring-yellow-400/50 placeholder-gray-400"
                                    placeholder="Add rule..."
                                    value={newRuleContent}
                                    onChange={e => setNewRuleContent(e.target.value)}
                                />
                                <button disabled={!newRuleContent.trim()} className="bg-yellow-500 text-white text-sm font-bold px-5 rounded-xl hover:bg-yellow-600 transition-colors">Add</button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- CARD 2: EXECUTION CHECKLIST (HABITS) --- */}
            <div className="mb-6">
                <SectionGroup
                    title="Execution Checklist"
                    tasks={habits}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onUpdateNote={handleUpdateNote}
                    headerAction={
                        <button onClick={() => setAddingType('habit')} className="text-xs font-bold text-gray-400 hover:text-black transition-colors">
                            + Add Item
                        </button>
                    }
                />
            </div>

            {/* --- DYNAMIC SECTIONS GRID --- */}
            {(sections.length > 0 || generalTasks.length > 0) && (
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {sections.map(section => (
                        <SectionGroup
                            key={section.id}
                            title={section.title}
                            tasks={allOneOffs.filter((t: any) => t.section_id === section.id)}
                            onToggle={handleToggle}
                            onDelete={handleDelete}
                            onUpdateNote={handleUpdateNote}
                            headerAction={
                                <button onClick={() => handleDeleteSection(section.id)} className="text-gray-300 hover:text-red-400">×</button>
                            }
                            onAddTask={() => { setActiveSectionId(section.id); setAddingType('task'); }}
                        />
                    ))}
                    {generalTasks.length > 0 && (
                        <SectionGroup
                            title="General"
                            tasks={generalTasks}
                            onToggle={handleToggle}
                            onDelete={handleDelete}
                            onUpdateNote={handleUpdateNote}
                            onAddTask={() => { setActiveSectionId(null); setAddingType('task'); }}
                        />
                    )}
                </div>
            )}

            {/* --- CARD 5: REFLECTION --- */}
            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 relative shadow-sm">
                <div className="grid md:grid-cols-2 gap-12">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-4 bg-gray-900 rounded-full"></div>
                            <h2 className={cn("text-lg font-bold text-gray-900", outfit.className)}>Today's Reflection</h2>
                        </div>
                        <textarea
                            value={data?.note || ''}
                            onChange={e => setData((prev: any) => ({ ...prev, note: e.target.value }))}
                            onBlur={() => saveSummary({ note: data.note })}
                            className="w-full text-lg leading-relaxed bg-transparent border-none p-0 focus:ring-0 placeholder-gray-300 resize-none h-32"
                            placeholder="What went well? What didn't?"
                        />
                        <div className="mt-4 flex items-center gap-4">
                            {/* Removed TLE Minutes Input */}
                        </div>
                    </div>

                    <div className="md:border-l border-gray-100 md:pl-12">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                            <h2 className={cn("text-lg font-bold text-gray-900", outfit.className)}>Why Tomorrow Matters</h2>
                        </div>
                        <textarea
                            value={data?.tomorrow_intent || ''}
                            onChange={e => setData((prev: any) => ({ ...prev, tomorrow_intent: e.target.value }))}
                            onBlur={() => saveSummary({ tomorrow_intent: data.tomorrow_intent })}
                            className="w-full text-lg leading-relaxed bg-transparent border-none p-0 focus:ring-0 placeholder-blue-200 text-blue-900 resize-none h-32"
                            placeholder="Start with intent..."
                        />
                    </div>
                </div>
                {saving && <div className="absolute bottom-4 right-8 text-xs font-bold text-gray-300">Syncing...</div>}
            </div>

            {/* MODALS */}
            <AnimatePresence>
                {addingType && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm"
                            onClick={() => setAddingType(null)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative z-10 border border-white/50"
                        >
                            {addingType === 'section' ? (
                                <form onSubmit={handleCreateSection}>
                                    <h3 className={cn("text-2xl font-bold mb-6 text-gray-900", outfit.className)}>New Company / Section</h3>
                                    <input autoFocus value={newSectionTitle} onChange={e => setNewSectionTitle(e.target.value)} className="w-full p-4 mb-4 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:ring-2 ring-blue-500/20 text-lg font-bold outline-none" placeholder="e.g. Acme Corp" />
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setAddingType(null)} className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl">Cancel</button>
                                        <button type="submit" disabled={!newSectionTitle.trim()} className="flex-1 py-3 bg-black text-white font-bold rounded-xl shadow-lg">Create</button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleCreate}>
                                    <h3 className={cn("text-2xl font-bold mb-6 text-gray-900", outfit.className)}>
                                        {addingType === 'habit' ? 'New Daily Habit' : 'New Task'}
                                    </h3>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Title</label>
                                            <input autoFocus value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 border-transparent focus:bg-white focus:ring-2 ring-blue-500/20 text-lg font-medium outline-none" placeholder="What needs doing?" />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Priority</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[0, 1, 2].map(p => (
                                                    <button key={p} type="button" onClick={() => setNewItemPriority(p)} className={cn("py-3 rounded-xl font-bold text-sm transition-all border", newItemPriority === p ? "border-black bg-black text-white shadow-lg" : "border-gray-100 bg-white text-gray-400 hover:border-gray-300")}>{PRIORITY_LABELS[p as 0 | 1 | 2]}</button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-4">
                                            <button type="button" onClick={() => setAddingType(null)} className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl">Cancel</button>
                                            <button type="submit" disabled={!newItemTitle.trim()} className="flex-1 py-3 bg-black text-white font-bold rounded-xl shadow-lg">Save</button>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function SectionGroup({ title, tasks, onToggle, onDelete, onUpdateNote, headerAction, onAddTask }: any) {
    return (
        <section className="bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-6">
                <h2 className={cn("text-lg font-bold text-gray-800", outfit.className)}>{title}</h2>
                {headerAction}
            </div>

            <div className="space-y-3">
                {tasks.length === 0 && (
                    <div className="p-6 border-2 border-dashed border-gray-100 rounded-2xl text-center">
                        <p className="text-gray-300 text-sm font-bold">No tasks yet.</p>
                    </div>
                )}
                <AnimatePresence>
                    {tasks.map((task: any) => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        // If date is BEFORE today AND not completed -> Carried Over
                        // NOTE: using UTC/Local logic can be tricky, relying on simple string comp from API
                        const isOverdue = task.date < todayStr && !task.completed;

                        return (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="relative"
                            >
                                {isOverdue && (
                                    <div className="absolute -top-2 left-4 px-2 py-0.5 bg-red-50 text-red-500 text-[10px] font-bold uppercase rounded-t-md z-0 border border-b-0 border-red-100">
                                        Carried Over
                                    </div>
                                )}
                                <div className={cn("relative z-10", isOverdue && "mt-3")}>
                                    <TaskItem task={task} onToggle={onToggle} onDelete={onDelete} onUpdateNote={onUpdateNote} />
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {onAddTask && (
                <button
                    onClick={onAddTask}
                    className="mt-6 w-full py-3 rounded-xl border border-dashed border-gray-200 text-gray-400 font-bold text-sm hover:border-gray-300 hover:text-gray-600 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    New Item
                </button>
            )}
        </section>
    );
}
