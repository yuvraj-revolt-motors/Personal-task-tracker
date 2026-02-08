"use client";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Outfit } from 'next/font/google';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const outfit = Outfit({ subsets: ['latin'] });
const PRIORITY_LABELS = { 0: 'LOW', 1: 'MED', 2: 'HIGH' };
// Removed hardcoded CATEGORIES in favor of dynamic sections from DB
const EMOJIS = ['🚀', '⭐', '🔥', '💡', '🎯', '🎨', '🏆', '⚡', '🦁', '🌊', '🏔️', '💎', '🧬', '🔮'];

const COLOR_MAP: Record<string, any> = {
    purple: { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-900', iconBg: 'bg-purple-100/50 text-purple-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-900', iconBg: 'bg-amber-100/50 text-amber-700' },
    red: { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-900', iconBg: 'bg-red-100/50 text-red-700' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-900', iconBg: 'bg-blue-100/50 text-blue-700' },
    green: { bg: 'bg-green-50', border: 'border-green-100', text: 'text-green-900', iconBg: 'bg-green-100/50 text-green-700' },
    pink: { bg: 'bg-pink-50', border: 'border-pink-100', text: 'text-pink-900', iconBg: 'bg-pink-100/50 text-pink-700' },
};

const getTodayStr = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

export default function TodayPage() {
    const router = useRouter();
    const [date] = useState(getTodayStr());

    // Data Loading
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null); // Daily Log (Tasks, Notes)
    const [habits, setHabits] = useState<any[]>([]); // Pillars/Cards
    const [user, setUser] = useState<any>(null);
    const [sections, setSections] = useState<any[]>([]);

    // UI States
    const [saving, setSaving] = useState(false);
    const [activeNote, setActiveNote] = useState<string | null>(null); // For habit card notes
    const [addingType, setAddingType] = useState<null | 'task' | 'gym_info' | 'profile' | 'habit' | 'edit_buy' | 'buy_category' | 'task_category' | 'finance'>(null);
    const [finances, setFinances] = useState<any[]>([]);
    const [editingFinance, setEditingFinance] = useState<any>(null);
    const [buyingList, setBuyingList] = useState<any[]>([]);
    const [newBuyItem, setNewBuyItem] = useState('');
    const [newBuyCategory, setNewBuyCategory] = useState('General');
    const [newBuyNote, setNewBuyNote] = useState('');
    const [buyCategories, setBuyCategories] = useState<any[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newTaskCategoryTitle, setNewTaskCategoryTitle] = useState('');
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isAlert?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isAlert: false
    });

    const openConfirm = (title: string, message: string, onConfirm: () => void, isAlert = false) => {
        setConfirmConfig({ isOpen: true, title, message, onConfirm, isAlert });
    };

    // Modals Data
    const [activeTaskDetails, setActiveTaskDetails] = useState<any>(null);
    const [editingHabit, setEditingHabit] = useState<any>(null);
    const [editingBuyItem, setEditingBuyItem] = useState<any>(null);

    // New Item Inputs (Task)
    const [newItemTitle, setNewItemTitle] = useState('');
    const [newItemPriority, setNewItemPriority] = useState(1);
    const [newItemCategory, setNewItemCategory] = useState('Personal');
    const [newItemNote, setNewItemNote] = useState('');
    const [newItemEstimatedTime, setNewItemEstimatedTime] = useState<number | null>(null);
    const [gymSchedule, setGymSchedule] = useState<any>({});
    const [scheduleLoaded, setScheduleLoaded] = useState(false);
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        const isDark = localStorage.getItem('theme') === 'dark';
        setDarkMode(isDark);
        if (isDark) document.documentElement.classList.add('dark');
    }, []);

    const toggleTheme = () => {
        const newMode = !darkMode;
        setDarkMode(newMode);
        localStorage.setItem('theme', newMode ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', newMode);
    };

    // New/Edit Habit Inputs
    const [habitForm, setHabitForm] = useState({ title: '', subtitle: '', icon: '📍', color: 'purple', track_streak: false });

    // Fetchers
    const fetchData = useCallback(() => {
        setLoading(true);
        fetch(`/api/dashboard?date=${date}`)
            .then(r => r.json())
            .then(res => {
                if (res.error) throw new Error(res.error);

                setData(res.dailyParams);
                setHabits(res.habits);
                setSections(res.sections);
                if (res.user) setUser(res.user);
                setBuyingList(res.buyingList);
                setBuyCategories(res.buyCategories);
                setFinances(res.finances || []);

                setLoading(false);
            })
            .catch(e => {
                console.error("Fetch error:", e);
                setLoading(false);
                toast.error("Fast-load failed. Retrying...");
            });
    }, [date]);

    const fetchBuyingList = useCallback(async () => {
        const r = await fetch('/api/buying');
        const data = await r.json();
        if (Array.isArray(data)) setBuyingList(data);
    }, []);

    const fetchBuyCategories = useCallback(async () => {
        const r = await fetch('/api/buying/categories');
        const data = await r.json();
        if (Array.isArray(data)) setBuyCategories(data);
    }, []);

    const toggleBuyItem = useCallback(async (item: any) => {
        const newCompleted = !item.completed;
        // Optimistic
        setBuyingList(prev => prev.map(i => i.id === item.id ? { ...i, completed: newCompleted ? 1 : 0 } : i));

        try {
            const res = await fetch('/api/buying', {
                method: 'PATCH',
                body: JSON.stringify({ id: item.id, completed: newCompleted })
            });
            if (!res.ok) throw new Error();
        } catch (err) {
            // Rollback
            setBuyingList(prev => prev.map(i => i.id === item.id ? { ...i, completed: !newCompleted ? 1 : 0 } : i));
            toast.error('Failed to sync shopping list');
        }
    }, []);

    const deleteBuyItem = useCallback(async (id: number) => {
        const originalItem = buyingList.find(i => i.id === id);
        // Optimistic
        setBuyingList(prev => prev.filter(i => i.id !== id));

        try {
            const res = await fetch('/api/buying', {
                method: 'DELETE',
                body: JSON.stringify({ id })
            });
            if (!res.ok) throw new Error();
        } catch (err) {
            // Rollback
            if (originalItem) setBuyingList(prev => [...prev, originalItem]);
            toast.error('Failed to delete item');
        }
    }, [buyingList]);

    const fetchFinances = useCallback(async () => {
        const r = await fetch('/api/finances');
        const data = await r.json();
        if (Array.isArray(data)) setFinances(data);
    }, []);

    const toggleFinancePaid = async (finance: any) => {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const isPaid = finance.last_paid_month === currentMonth;

        const newMonth = isPaid ? null : currentMonth;
        let newPaidMonths = finance.paid_months;
        if (finance.type === 'emi') {
            newPaidMonths = isPaid ? Math.max(0, finance.paid_months - 1) : finance.paid_months + 1;
        }

        // Optimistic
        setFinances(prev => prev.map(f => f.id === finance.id ? { ...f, last_paid_month: newMonth, paid_months: newPaidMonths } : f));

        try {
            const res = await fetch('/api/finances', {
                method: 'PATCH',
                body: JSON.stringify({
                    id: finance.id,
                    last_paid_month: newMonth,
                    paid_months: newPaidMonths
                })
            });
            if (!res.ok) throw new Error();
            toast.success(isPaid ? 'Payment unmarked' : 'Payment marked as done!');
        } catch (err) {
            fetchFinances();
            toast.error('Failed to update finance');
        }
    };

    useEffect(() => {
        fetchData();
        fetchBuyCategories();
        const saved = localStorage.getItem('gymScheduleV2');
        if (saved) {
            try { setGymSchedule(JSON.parse(saved)); } catch (e) { }
        } else {
            // Default Plan
            setGymSchedule({
                Monday: 'Chest day',
                Tuesday: 'Triceps',
                Wednesday: 'Back',
                Thursday: 'Bicep',
                Friday: 'Shoulder',
                Saturday: 'Leg',
                Sunday: 'Rest'
            });
        }
        setScheduleLoaded(true);
    }, [fetchData]);

    useEffect(() => {
        if (scheduleLoaded) {
            localStorage.setItem('gymScheduleV2', JSON.stringify(gymSchedule));
        }
    }, [gymSchedule, scheduleLoaded]);

    const saveSummary = useCallback(async (newDataSummary: any) => {
        setSaving(true);
        setData((prev: any) => ({ ...prev, ...newDataSummary }));
        await fetch('/api/daily', { method: 'POST', body: JSON.stringify({ date, ...newDataSummary }) });
        setSaving(false);
    }, [date]);

    // --- Habit Logic ---
    const handleSaveHabit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingHabit?.id) {
                // Update
                const res = await fetch('/api/habits', {
                    method: 'PUT',
                    body: JSON.stringify({ id: editingHabit.id, ...habitForm })
                });
                if (!res.ok) throw new Error();
                toast.success('Card updated');
            } else {
                // Create
                const randomIcon = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
                const res = await fetch('/api/habits', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: habitForm.title,
                        subtitle: '',
                        icon: randomIcon,
                        color: 'purple',
                        track_streak: habitForm.track_streak
                    })
                });
                if (!res.ok) throw new Error();
                toast.success('Card added');
            }
            fetchData();
            setAddingType(null);
            setEditingHabit(null);
            setEditingHabit(null);
            setHabitForm({ title: '', subtitle: '', icon: '📍', color: 'purple', track_streak: false });
        } catch (err) {
            toast.error('Failed to save card');
        }
    };

    const handleDeleteHabit = (id: number) => {
        openConfirm(
            'Delete Card',
            'Are you sure you want to delete this card? This action cannot be undone.',
            async () => {
                try {
                    await fetch('/api/habits', {
                        method: 'DELETE',
                        body: JSON.stringify({ id })
                    });
                    toast.success('Card deleted');
                    fetchData();
                } catch (e) {
                    toast.error('Failed to delete');
                }
            }
        );
    };


    const toggleHabit = useCallback(async (habit: any) => {
        // Optimistic UI Update
        const newCompleted = !habit.completed;
        const streakChange = newCompleted ? 1 : -1;

        setHabits(prev => prev.map(h => {
            if (h.id === habit.id) {
                const updatedStreak = h.track_streak ? Math.max(0, (h.streak || 0) + streakChange) : (h.streak || 0);
                return { ...h, completed: newCompleted ? 1 : 0, streak: updatedStreak };
            }
            return h;
        }));

        try {
            const res = await fetch('/api/habits/log', {
                method: 'POST',
                body: JSON.stringify({
                    date,
                    habit_id: habit.id,
                    completed: newCompleted,
                    time_spent: habit.time_spent,
                    note: habit.log_note
                })
            });
            if (!res.ok) throw new Error('Failed to sync');
        } catch (err) {
            // Rollback if failed
            setHabits(prev => prev.map(h => {
                if (h.id === habit.id) {
                    const rollbackStreak = h.track_streak ? Math.max(0, (h.streak || 0) - streakChange) : (h.streak || 0);
                    return { ...h, completed: !newCompleted ? 1 : 0, streak: rollbackStreak };
                }
                return h;
            }));
            toast.error('Sync failed. Please refresh.');
        }
    }, [date]);

    const updateHabitLog = useCallback(async (habitId: number, updates: any) => {
        // Map 'note' -> 'log_note' for local state consistency
        const localUpdates = { ...updates };
        if (updates.note !== undefined) localUpdates.log_note = updates.note;

        setHabits(prev => prev.map(h => h.id === habitId ? { ...h, ...localUpdates } : h));
        await fetch('/api/habits/log', {
            method: 'POST',
            body: JSON.stringify({
                date,
                habit_id: habitId,
                ...updates
            })
        });
    }, [date]);

    // --- Task Logic ---
    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemTitle.trim()) return;

        const currentSections = Array.isArray(sections) ? sections : [];
        const selectedSection = currentSections.find(s => s.title === newItemCategory);
        const section_id = selectedSection ? selectedSection.id : null;

        const payload = {
            date,
            title: newItemTitle,
            priority: newItemPriority,
            type: 'task',
            section_id: section_id,
            note: newItemNote,
            estimated_time: newItemEstimatedTime,
        };

        setNewItemTitle('');
        setAddingType(null);

        try {
            await fetch('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
            // Refresh only daily data usually sufficient
            const r = await fetch(`/api/daily?date=${date}`);
            setData(await r.json());
            toast.success('Task Added');
        } catch (e) {
            toast.error('Failed');
        }
    };

    const handleDeleteTask = (id: number) => {
        openConfirm(
            'Delete Task',
            'Are you sure you want to delete this task?',
            async () => {
                try {
                    await fetch('/api/tasks', { method: 'DELETE', body: JSON.stringify({ id }) });
                    // Refresh
                    const r = await fetch(`/api/daily?date=${date}`);
                    setData(await r.json());
                    toast.success('Task Deleted');
                } catch (e) {
                    toast.error('Failed');
                }
            }
        );
    };

    const handleTaskAction = async (method: string, body: any) => {
        await fetch('/api/tasks', { method, body: JSON.stringify(body) });
        // Quick refresh
        const r = await fetch(`/api/daily?date=${date}`);
        setData(await r.json());
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    // --- Derived State ---
    const currentDayIndex = new Date().getDay();
    const userInitials = user?.name ? user.name.split(' ').map((n: any) => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

    const sortedHabits = useMemo(() => {
        if (!Array.isArray(habits)) return [];
        return [...habits].sort((a, b) => {
            // Sort by pending first (0), then done (1)
            const aComp = !!a.completed;
            const bComp = !!b.completed;
            if (aComp === bComp) return a.id - b.id;
            return aComp ? 1 : -1;
        });
    }, [habits]);

    const processedCategories = useMemo(() => {
        const titles = sections.map((s: any) => s.title);
        // Default categories if none exist (though signup seeds them now)
        if (titles.length === 0) return ['Work', 'Personal', 'Misc'];

        // Ensure 'Misc' is always there even if not in DB
        return titles.includes('Misc') ? titles : [...titles, 'Misc'];
    }, [sections]);

    const mainHabits = sortedHabits.slice(0, 3);
    const sideHabits = sortedHabits.slice(3);

    const pendingTasks = data?.tasks?.filter((t: any) => !t.completed && !t.habit_id) || [];
    const doneTasks = data?.tasks?.filter((t: any) => t.completed && !t.habit_id) || [];

    if (loading) return <div className="flex h-screen items-center justify-center text-gray-400 animate-pulse bg-[#F0F4F8]">Loading Execution Tracker...</div>;

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-20 min-h-screen dark:bg-gray-950 transition-colors">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 pt-4">
                <div className="animate-in fade-in slide-in-from-left duration-700">
                    <p className="text-gray-400 font-bold text-[10px] md:text-xs uppercase tracking-[0.2em] mb-1">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <h1 className={cn("text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tight", outfit.className)}>Dashboard</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                    <button onClick={toggleTheme} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-lg hover:border-black dark:hover:border-white transition-all shadow-sm active:scale-95">
                        {darkMode ? '🌙' : '☀️'}
                    </button>
                    <button onClick={() => { setEditingHabit(null); setHabitForm({ title: '', subtitle: '', icon: '📍', color: 'purple', track_streak: false }); setAddingType('habit'); }} className="bg-black text-white dark:bg-white dark:text-black px-5 md:px-6 h-10 md:h-12 rounded-2xl text-xs font-black shadow-xl hover:scale-105 active:scale-95 transition-all">
                        + New Card
                    </button>
                    <button onClick={() => setAddingType('gym_info')} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 px-4 h-10 md:h-12 rounded-2xl text-[10px] md:text-xs font-black hover:border-black dark:hover:border-white transition-all shadow-sm active:scale-95 max-w-[140px] truncate">
                        {gymSchedule[new Date().toLocaleDateString('en-US', { weekday: 'long' })] ? `Gym: ${gymSchedule[new Date().toLocaleDateString('en-US', { weekday: 'long' })]}` : 'Gym Info'}
                    </button>
                    <button
                        onClick={() => setAddingType('profile')}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white font-black text-sm flex items-center justify-center hover:shadow-lg hover:shadow-blue-500/20 active:scale-90 transition-all border-4 border-white dark:border-gray-950"
                        title={user?.name}
                    >
                        {userInitials}
                    </button>
                </div>
            </div>

            {/* SWIPEABLE HABIT CARDS */}
            <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory p-4 items-stretch mb-8 border border-transparent">
                <AnimatePresence mode='popLayout'>
                    {sortedHabits.map(h => {
                        const isGym = h.title.toLowerCase().trim() === 'gym';
                        const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                        const gymWorkout = gymSchedule[todayDay];
                        const displayHabit = isGym && gymWorkout ? { ...h, subtitle: gymWorkout } : h;

                        return (
                            <motion.div
                                key={h.id}
                                layout
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="snap-center shrink-0 w-[85vw] md:w-[350px]"
                            >
                                <DashboardCard
                                    habit={displayHabit}
                                    onToggle={() => toggleHabit(h)}
                                    onUpdateLog={(updates: any) => updateHabitLog(h.id, updates)}
                                    isNoteOpen={activeNote === String(h.id)}
                                    onToggleNote={() => setActiveNote(activeNote === String(h.id) ? null : String(h.id))}
                                    onEdit={() => { setHabitForm({ title: h.title, subtitle: h.subtitle, icon: h.icon, color: h.color, track_streak: !!h.track_streak }); setEditingHabit(h); setAddingType('habit'); }}
                                    onDelete={() => handleDeleteHabit(h.id)}
                                    cardioInfo={isGym ? "Mon-Fri: 2.5k Run, Pullups, Plank... \nSat: Stairs, Incline Walk..." : null}
                                />
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* Large Add Button Card */}
                <div className="snap-center shrink-0 w-[85vw] md:w-[350px]">
                    <button
                        onClick={() => { setEditingHabit(null); setHabitForm({ title: '', subtitle: '', icon: '📍', color: 'purple', track_streak: false }); setAddingType('habit'); }}
                        className="h-full w-full border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all min-h-[300px]"
                    >
                        <span className="text-6xl mb-4 text-gray-200 group-hover:text-blue-200 transition-colors">+</span>
                        <span className="text-xl font-bold text-gray-300 group-hover:text-blue-400 transition-colors">Add Card</span>
                    </button>
                </div>
            </div>

            {/* TASKS GRID */}
            <div className="grid md:grid-cols-4 gap-6">
                <div className="md:col-span-3 space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className={cn("text-xl font-bold text-gray-900 dark:text-white", outfit.className)}>Tasks by Category</h2>
                        <button onClick={() => setAddingType('task')} className="bg-black text-white dark:bg-white dark:text-black px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-all">+ Add Task</button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {processedCategories.map((cat: string) => {
                            const catTasks = pendingTasks.filter((t: any) => (t.section_title || 'Misc') === cat || (cat === 'Misc' && !t.section_title));
                            return (
                                <div key={cat} data-section={cat} className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 relative group/section min-h-[100px] transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{cat}</h3>
                                        {cat !== 'Misc' && (
                                            <button
                                                onClick={async () => {
                                                    if (catTasks.length > 0) {
                                                        openConfirm('Action Required', 'Move or delete items in this section first before deleting it.', () => { }, true);
                                                        return;
                                                    }
                                                    openConfirm(
                                                        'Delete Section',
                                                        `Are you sure you want to delete the section "${cat}"?`,
                                                        async () => {
                                                            const section = sections.find(s => s.title === cat);
                                                            if (section) {
                                                                await fetch('/api/sections', { method: 'DELETE', body: JSON.stringify({ id: section.id }) });
                                                                const r = await fetch(`/api/dashboard?date=${date}`);
                                                                const res = await r.json();
                                                                setSections(res.sections);
                                                                toast.success('Section deleted');
                                                            }
                                                        }
                                                    );
                                                }}
                                                className="opacity-0 group-hover/section:opacity-100 transition-opacity text-red-500 text-xs px-2"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {catTasks.length === 0 && <div className="text-xs text-gray-300 font-medium py-2">No tasks</div>}
                                        {catTasks.map((t: any) => (
                                            <TaskCard
                                                key={t.id}
                                                task={t}
                                                onToggle={(id: any, c: any) => handleTaskAction('PATCH', { id, completed: c, date: date })}
                                                onMove={async (id: any, newCat: string, newPriority?: number) => {
                                                    const section = sections.find(s => s.title === newCat);
                                                    const body: any = { id, section_id: section?.id || null };
                                                    if (newPriority !== undefined) body.priority = newPriority;
                                                    await handleTaskAction('PATCH', body);
                                                    if (newPriority !== undefined) {
                                                        const pLabels = ['LOW', 'MED', 'HIGH'];
                                                        toast.success(`Priority set to ${pLabels[newPriority]}`);
                                                    } else {
                                                        toast.success(`Moved to ${newCat}`);
                                                    }
                                                }}
                                                onClick={() => setActiveTaskDetails(t)}
                                                onDelete={() => handleDeleteTask(t.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Done Tasks */}
                <div className="md:col-span-1">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 h-full shadow-sm sticky top-4">
                        <h3 className="text-sm font-black text-green-600 uppercase tracking-widest mb-4 flex items-center gap-2">✓ Done ({doneTasks.length})</h3>
                        <div className="space-y-6 overflow-y-auto max-h-[80vh] pr-2 custom-scrollbar">
                            {processedCategories.map((cat: string) => {
                                const catDoneTasks = doneTasks.filter((t: any) => (t.section_title || 'Misc') === cat || (cat === 'Misc' && !t.section_title));
                                if (catDoneTasks.length === 0) return null;
                                return (
                                    <div key={cat}>
                                        <h4 className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest mb-2 border-b border-gray-100 dark:border-gray-800 pb-1">{cat}</h4>
                                        <div className="space-y-2">
                                            {catDoneTasks.map((t: any) => (
                                                <div key={t.id} className="opacity-60 hover:opacity-100 transition-opacity">
                                                    <TaskCard task={t} onToggle={(id: any, c: any) => handleTaskAction('PATCH', { id, completed: c, date: date })} compact onClick={() => setActiveTaskDetails(t)} onDelete={() => handleDeleteTask(t.id)} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Reflection */}
            {/* SHOPPING / BUYING LIST */}
            <div className="mt-12 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-8 relative shadow-sm">
                <h2 className={cn("text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3", outfit.className)}>
                    <span className="bg-yellow-100 text-yellow-700 w-10 h-10 rounded-xl flex items-center justify-center text-xl">🛒</span>
                    Shopping List
                </h2>

                <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 lg:gap-12">
                    <div className="space-y-8">
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar-x items-center">
                                {buyCategories.map(cat => (
                                    <div key={cat.id} className="relative group/cat">
                                        <button
                                            onClick={() => setNewBuyCategory(cat.name)}
                                            className={cn(
                                                "px-3 py-1 rounded-full text-[10px] font-bold border transition-all whitespace-nowrap",
                                                newBuyCategory === cat.name
                                                    ? "bg-black text-white border-black dark:bg-white dark:text-black"
                                                    : "bg-transparent text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400"
                                            )}
                                        >
                                            {cat.name}
                                        </button>
                                        {cat.name !== 'General' && (
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const hasActiveItems = buyingList.some(item => !item.completed && item.category === cat.name);
                                                    if (hasActiveItems) {
                                                        openConfirm('Action Required', `Cannot remove "${cat.name}" while it has items in the "To Buy" section.`, () => { }, true);
                                                        return;
                                                    }
                                                    openConfirm(
                                                        'Remove Category',
                                                        `Remove category "${cat.name}"? (History will be preserved)`,
                                                        async () => {
                                                            await fetch('/api/buying/categories', { method: 'DELETE', body: JSON.stringify({ id: cat.id }) });
                                                            fetchBuyCategories();
                                                            if (newBuyCategory === cat.name) setNewBuyCategory('General');
                                                        }
                                                    );
                                                }}
                                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover/cat:opacity-100 transition-opacity"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button onClick={() => {
                                    setNewCategoryName('');
                                    setAddingType('buy_category');
                                }} className="px-3 py-1 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 text-[10px] font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap">+ New Category</button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                                    <input
                                        value={newBuyItem}
                                        onChange={e => setNewBuyItem(e.target.value)}
                                        onKeyDown={async e => {
                                            if (e.key === 'Enter' && newBuyItem.trim()) {
                                                const r = await fetch('/api/buying', { method: 'POST', body: JSON.stringify({ item: newBuyItem, category: newBuyCategory, note: newBuyNote }) });
                                                if (r.ok) {
                                                    setNewBuyItem('');
                                                    setNewBuyNote('');
                                                    fetchBuyingList();
                                                    toast.success('Added to list');
                                                }
                                            }
                                        }}
                                        className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 font-bold text-gray-900 dark:text-white outline-none focus:ring-2 ring-black/5 dark:ring-white/10"
                                        placeholder={`Buy for ${newBuyCategory}...`}
                                    />
                                    <input
                                        value={newBuyNote}
                                        onChange={e => setNewBuyNote(e.target.value)}
                                        className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-xs font-medium text-gray-600 dark:text-gray-400 outline-none focus:ring-2 ring-black/5 dark:ring-white/10"
                                        placeholder="Add a note... (optional)"
                                    />
                                </div>
                                <button onClick={async () => {
                                    if (newBuyItem.trim()) {
                                        const r = await fetch('/api/buying', { method: 'POST', body: JSON.stringify({ item: newBuyItem, category: newBuyCategory, note: newBuyNote }) });
                                        if (r.ok) {
                                            setNewBuyItem('');
                                            setNewBuyNote('');
                                            fetchBuyingList();
                                            toast.success('Added');
                                        }
                                    }
                                }} className="bg-black dark:bg-white text-white dark:text-black font-bold px-6 py-4 sm:py-0 rounded-xl hover:opacity-80 transition-opacity">
                                    Add
                                </button>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 min-h-[200px] border border-gray-100 dark:border-gray-800/50">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">To Buy</h3>
                            <div className="space-y-4">
                                {buyingList.filter(i => !i.completed).length === 0 && <p className="text-gray-300 text-sm text-center py-8 italic">Nothing to buy! 🎉</p>}
                                {Object.entries(buyingList.filter(i => !i.completed).reduce((acc: any, item: any) => {
                                    const cat = item.category || 'General';
                                    if (!acc[cat]) acc[cat] = [];
                                    acc[cat].push(item);
                                    return acc;
                                }, {})).map(([category, items]: any) => (
                                    <div key={category}>
                                        <h4 className="text-[10px] font-bold text-gray-400/70 uppercase mb-2 ml-1">{category}</h4>
                                        <div className="space-y-2">
                                            {items.map((item: any) => (
                                                <div key={item.id} className="flex items-center gap-3 group bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm relative">
                                                    <button onClick={() => toggleBuyItem(item)} className="w-5 h-5 rounded-md border-2 border-gray-300 hover:border-green-500 hover:text-green-500 transition-colors flex items-center justify-center text-transparent hover:text-current">✓</button>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-gray-700 dark:text-gray-200 text-sm">{item.item}</p>
                                                        {item.note && <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-0.5">{item.note}</p>}
                                                    </div>
                                                    <button onClick={() => {
                                                        setEditingBuyItem(item);
                                                        setAddingType('edit_buy');
                                                    }} className="ml-auto text-gray-300 hover:text-black dark:hover:text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">✎</button>
                                                    <button onClick={() => {
                                                        openConfirm('Delete Item', 'Are you sure?', () => deleteBuyItem(item.id));
                                                    }} className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">🗑️</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>
                    </div>

                    <div className="bg-green-50 dark:bg-green-900/10 rounded-2xl p-6 border border-green-100 dark:border-green-900/20 h-fit">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">Purchased History</h3>
                            {buyingList.some(i => i.completed) && (
                                <button
                                    onClick={async () => {
                                        openConfirm(
                                            'Clear History',
                                            'Are you sure you want to clear all purchase history? This cannot be undone.',
                                            async () => {
                                                const completedItems = buyingList.filter(i => i.completed);
                                                // Optimistic
                                                setBuyingList(prev => prev.filter(i => !i.completed));

                                                try {
                                                    for (const item of completedItems) {
                                                        await fetch('/api/buying', { method: 'DELETE', body: JSON.stringify({ id: item.id }) });
                                                    }
                                                    toast.success('History cleared');
                                                } catch (err) {
                                                    fetchBuyingList(); // Refresh to recovery
                                                    toast.error('Partial failure clearing history');
                                                }
                                            }
                                        );
                                    }}
                                    className="text-[10px] text-red-500 hover:text-red-600 font-bold uppercase tracking-tighter transition-colors"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {buyingList.filter(i => i.completed).length === 0 && <p className="text-green-800/30 dark:text-green-400/30 text-sm italic">Purchased items appear here</p>}
                            {Object.entries(buyingList.filter(i => i.completed).reduce((acc: any, item: any) => {
                                const cat = item.category || 'General';
                                if (!acc[cat]) acc[cat] = [];
                                acc[cat].push(item);
                                return acc;
                            }, {})).map(([category, items]: any) => (
                                <div key={category}>
                                    <h4 className="text-[10px] font-bold text-green-800/50 dark:text-green-400/50 uppercase mb-2 ml-1">{category}</h4>
                                    <div className="space-y-2">
                                        {items.map((item: any) => (
                                            <div key={item.id} className="flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity pl-2 border-l-2 border-green-500/20">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-gray-500 dark:text-gray-400 line-through decoration-green-500/30 text-sm">{item.item}</p>
                                                    {item.note && <p className="text-[9px] text-gray-400 dark:text-gray-500 italic line-through decoration-green-500/10">{item.note}</p>}
                                                </div>
                                                <div className="ml-auto flex items-center gap-3">
                                                    <button onClick={() => toggleBuyItem(item)} className="text-xs text-blue-400 hover:underline">Undo</button>
                                                    <button onClick={() => {
                                                        setEditingBuyItem(item);
                                                        setAddingType('edit_buy');
                                                    }} className="text-gray-300 hover:text-black dark:hover:text-white text-xs">✎</button>
                                                    <button onClick={() => {
                                                        openConfirm('Delete from history', 'Are you sure?', () => deleteBuyItem(item.id));
                                                    }} className="text-gray-300 hover:text-red-500 text-xs ml-3">🗑️</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div >
            </div >

            {/* FINANCE TRACKER */}
            <div className="mt-12 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2rem] p-8 relative shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h2 className={cn("text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3", outfit.className)}>
                        <span className="bg-green-100 text-green-700 w-10 h-10 rounded-xl flex items-center justify-center text-xl">💰</span>
                        Finance Tracker
                    </h2>
                    <button onClick={() => { setEditingFinance({ title: '', amount: 0, type: 'payment', total_months: 0, paid_months: 0, note: '' }); setAddingType('finance'); }} className="bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-all">+ Add Monthly Spend</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {finances.length === 0 && <div className="col-span-full py-12 text-center text-gray-300 italic">No finances tracked yet. Add your EMIs or monthly bills!</div>}
                    {finances.map(f => {
                        const currentMonth = new Date().toISOString().slice(0, 7);
                        const isPaid = f.last_paid_month === currentMonth;
                        return (
                            <div key={f.id} className={cn("group relative bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6 border transition-all", isPaid ? "border-green-200 dark:border-green-900/30 bg-green-50/30" : "border-gray-100 dark:border-gray-800 hover:border-gray-300")}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white uppercase text-xs tracking-widest">{f.title}</h3>
                                        <p className="text-2xl font-black mt-1 text-gray-900 dark:text-white">₹{f.amount.toLocaleString()}</p>
                                    </div>
                                    <div className={cn("px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter", f.type === 'emi' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700")}>
                                        {f.type}
                                    </div>
                                </div>

                                {f.type === 'emi' && (
                                    <div className="mb-4">
                                        <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                                            <span>Progress</span>
                                            <span>{f.paid_months} / {f.total_months} months</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-purple-500 transition-all duration-500"
                                                style={{ width: `${Math.min(100, (f.paid_months / f.total_months) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {f.note && <p className="text-xs text-gray-500 dark:text-gray-400 italic mb-4 line-clamp-2">"{f.note}"</p>}

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleFinancePaid(f)}
                                        className={cn(
                                            "flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                                            isPaid
                                                ? "bg-green-500 text-white shadow-lg shadow-green-200"
                                                : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-600 hover:bg-gray-50"
                                        )}
                                    >
                                        {isPaid ? "✓ Paid this Month" : "Mark as Paid"}
                                    </button>
                                    <button
                                        onClick={() => { setEditingFinance(f); setAddingType('finance'); }}
                                        className="w-12 h-12 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                                    >
                                        ✎
                                    </button>
                                    <button
                                        onClick={() => openConfirm('Delete Finance', `Delete ${f.title}?`, async () => {
                                            await fetch('/api/finances', { method: 'DELETE', body: JSON.stringify({ id: f.id }) });
                                            fetchFinances();
                                            toast.success('Deleted');
                                        })}
                                        className="w-12 h-12 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* MODALS */}
            <AnimatePresence>
                {/* FINANCE MODAL */}
                {
                    addingType === 'finance' && editingFinance && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setAddingType(null)}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl border dark:border-gray-800" onClick={e => e.stopPropagation()}>
                                <h3 className="text-2xl font-bold mb-6 dark:text-white">{editingFinance.id ? 'Edit Spend' : 'Add Monthly Spend'}</h3>
                                <div className="space-y-4">
                                    <input
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-sm font-bold placeholder:text-gray-300 dark:text-white focus:outline-none focus:ring-2 ring-black/5"
                                        placeholder="Title (e.g. Car EMI, CC Bill)"
                                        value={editingFinance.title}
                                        onChange={e => setEditingFinance({ ...editingFinance, title: e.target.value })}
                                    />
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Amount</label>
                                            <input
                                                type="number"
                                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-sm font-bold dark:text-white focus:outline-none focus:ring-2 ring-black/5"
                                                value={editingFinance.amount}
                                                onChange={e => setEditingFinance({ ...editingFinance, amount: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Type</label>
                                            <select
                                                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-sm font-bold dark:text-white focus:outline-none focus:ring-2 ring-black/5 appearance-none px-4"
                                                value={editingFinance.type}
                                                onChange={e => setEditingFinance({ ...editingFinance, type: e.target.value })}
                                            >
                                                <option value="payment">Regular Bill</option>
                                                <option value="emi">EMI</option>
                                                <option value="card">Credit Card</option>
                                            </select>
                                        </div>
                                    </div>

                                    {editingFinance.type === 'emi' && (
                                        <div className="flex gap-4">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Paid Months</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-sm font-bold dark:text-white focus:outline-none focus:ring-2 ring-black/5"
                                                    value={editingFinance.paid_months}
                                                    onChange={e => setEditingFinance({ ...editingFinance, paid_months: parseInt(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Total Months</label>
                                                <input
                                                    type="number"
                                                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-sm font-bold dark:text-white focus:outline-none focus:ring-2 ring-black/5"
                                                    value={editingFinance.total_months}
                                                    onChange={e => setEditingFinance({ ...editingFinance, total_months: parseInt(e.target.value) || 0 })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <textarea
                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 text-sm font-medium h-24 focus:outline-none focus:ring-2 ring-black/5 resize-none dark:text-white"
                                        placeholder="Note / Reason for this spend..."
                                        value={editingFinance.note}
                                        onChange={e => setEditingFinance({ ...editingFinance, note: e.target.value })}
                                    />

                                    <div className="flex gap-4 pt-4">
                                        <button onClick={() => setAddingType(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                                        <button
                                            onClick={async () => {
                                                const method = editingFinance.id ? 'PATCH' : 'POST';
                                                const res = await fetch('/api/finances', {
                                                    method,
                                                    body: JSON.stringify(editingFinance)
                                                });
                                                if (res.ok) {
                                                    fetchFinances();
                                                    setAddingType(null);
                                                    toast.success(editingFinance.id ? 'Updated' : 'Added');
                                                }
                                            }}
                                            disabled={!editingFinance.title}
                                            className="flex-1 bg-black dark:bg-white text-white dark:text-black font-bold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-30"
                                        >
                                            {editingFinance.id ? 'Save Changes' : 'Add Spend'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )
                }
                {/* BUY CATEGORY FORM MODAL */}
                {
                    addingType === 'buy_category' && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setAddingType(null)}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border dark:border-gray-800" onClick={e => e.stopPropagation()}>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (newCategoryName.trim()) {
                                        await fetch('/api/buying/categories', { method: 'POST', body: JSON.stringify({ name: newCategoryName }) });
                                        fetchBuyCategories();
                                        setNewBuyCategory(newCategoryName);
                                        setAddingType(null);
                                        setNewCategoryName('');
                                        toast.success('Category added');
                                    }
                                }}>
                                    <h3 className="text-2xl font-bold mb-6 dark:text-white">New Category</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase">Category Name</label>
                                            <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-bold text-lg dark:text-white" placeholder="e.g. Work 💼" />
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-black text-white dark:bg-white dark:text-black font-bold py-4 rounded-xl text-lg mt-6">Create Category</button>
                                </form>
                            </motion.div>
                        </div>
                    )
                }

                {/* HABIT FORM MODAL */}
                {/* EDIT BUY ITEM MODAL */}
                {
                    addingType === 'edit_buy' && editingBuyItem && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => { setAddingType(null); setEditingBuyItem(null); }}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl border dark:border-gray-800" onClick={e => e.stopPropagation()}>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const res = await fetch('/api/buying', {
                                        method: 'PATCH',
                                        body: JSON.stringify({ id: editingBuyItem.id, item: editingBuyItem.item, note: editingBuyItem.note })
                                    });
                                    if (res.ok) {
                                        toast.success('Updated');
                                        fetchBuyingList();
                                        setAddingType(null);
                                        setEditingBuyItem(null);
                                    }
                                }}>
                                    <h3 className="text-2xl font-bold mb-6 dark:text-white">Edit Item</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase">Item Name</label>
                                            <input autoFocus value={editingBuyItem.item} onChange={e => setEditingBuyItem({ ...editingBuyItem, item: e.target.value })} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-bold text-lg dark:text-white" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase">Note</label>
                                            <textarea value={editingBuyItem.note || ''} onChange={e => setEditingBuyItem({ ...editingBuyItem, note: e.target.value })} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-medium text-sm dark:text-white min-h-[100px] resize-none" placeholder="Add extra details..." />
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-black text-white dark:bg-white dark:text-black font-bold py-4 rounded-xl text-lg mt-6">Save Changes</button>
                                </form>
                            </motion.div>
                        </div>
                    )
                }
                {
                    addingType === 'habit' && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setAddingType(null)}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl border dark:border-gray-800" onClick={e => e.stopPropagation()}>
                                <form onSubmit={handleSaveHabit}>
                                    <h3 className="text-2xl font-bold mb-6 dark:text-white">{editingHabit ? 'Edit Card' : 'New Card'}</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase">Title</label>
                                            <input autoFocus value={habitForm.title} onChange={e => setHabitForm({ ...habitForm, title: e.target.value })} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-bold text-lg dark:text-white" placeholder="e.g. Reading" />
                                        </div>
                                        <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-800/50 p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                            <input type="checkbox" id="trackStreak" checked={!!habitForm.track_streak} onChange={e => setHabitForm({ ...habitForm, track_streak: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black accent-black" />
                                            <label htmlFor="trackStreak" className="text-sm font-bold text-gray-600 dark:text-gray-300 flex items-center gap-2 cursor-pointer select-none">
                                                Track Streak? <span className="text-lg">🔥</span>
                                            </label>
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-black text-white dark:bg-gray-100 dark:text-black font-bold py-4 rounded-xl text-lg mt-6">{editingHabit ? 'Save Changes' : 'Create Card'}</button>
                                </form>
                            </motion.div>
                        </div>
                    )
                }

                {/* TASK FORM MODAL */}
                {
                    addingType === 'task' && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setAddingType(null)}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl border dark:border-gray-800" onClick={e => e.stopPropagation()}>
                                <form onSubmit={handleCreateTask}>
                                    <h3 className="text-2xl font-bold mb-6 dark:text-white">New Task</h3>
                                    <input autoFocus value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 dark:text-white text-lg font-bold mb-4 outline-none focus:ring-2 ring-black/5" placeholder="Do the laundry..." />
                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Category</label>
                                        <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-1">
                                            {processedCategories.map((cat: string) => (
                                                <button key={cat} type="button" onClick={() => setNewItemCategory(cat)} className={cn("py-2 rounded-xl font-bold border text-sm", newItemCategory === cat ? "bg-black text-white border-black dark:bg-white dark:text-black" : "border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500")}>{cat}</button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewTaskCategoryTitle('');
                                                    setAddingType('task_category');
                                                }}
                                                className="py-2 rounded-xl font-bold border border-dashed border-gray-300 text-gray-400 text-sm hover:border-gray-500"
                                            >
                                                + New
                                            </button>
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-black text-white dark:bg-white dark:text-black font-bold py-4 rounded-xl text-lg mt-4">Add Pending Task</button>
                                </form>
                            </motion.div>
                        </div>
                    )
                }

                {/* PROFILE MODAL */}
                {
                    addingType === 'profile' && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setAddingType(null)}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center" onClick={e => e.stopPropagation()}>
                                <div className="w-20 h-20 rounded-full bg-black text-white flex items-center justify-center text-3xl font-black mx-auto mb-4">{userInitials}</div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-1">{user?.name}</h3>
                                <p className="text-gray-400 font-medium text-sm mb-8">{user?.email}</p>
                                <button onClick={handleLogout} className="w-full bg-red-50 text-red-600 font-bold py-4 rounded-xl text-lg hover:bg-red-100 transition-colors">Logout</button>
                            </motion.div>
                        </div>
                    )
                }

                {/* TASK CATEGORY FORM MODAL */}
                {
                    addingType === 'task_category' && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setAddingType('task')}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border dark:border-gray-800" onClick={e => e.stopPropagation()}>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (newTaskCategoryTitle.trim()) {
                                        const r = await fetch('/api/sections', { method: 'POST', body: JSON.stringify({ title: newTaskCategoryTitle }) });
                                        const res = await r.json();
                                        if (res.title) {
                                            setSections([...sections, res]);
                                            setNewItemCategory(res.title);
                                            setAddingType('task');
                                            setNewTaskCategoryTitle('');
                                            toast.success('Category added');
                                        }
                                    }
                                }}>
                                    <h3 className="text-2xl font-bold mb-6 dark:text-white">New Task Category</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-400 uppercase">Category Title</label>
                                            <input autoFocus value={newTaskCategoryTitle} onChange={e => setNewTaskCategoryTitle(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 font-bold text-lg dark:text-white" placeholder="e.g. Finance 💰" />
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-black text-white dark:bg-white dark:text-black font-bold py-4 rounded-xl text-lg mt-6">Create Category</button>
                                </form>
                            </motion.div>
                        </div>
                    )
                }

                {/* TASK DETAILS MODAL */}
                {
                    activeTaskDetails && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setActiveTaskDetails(null)}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-xl font-bold text-gray-900">{activeTaskDetails.title}</h3>
                                    <button onClick={() => setActiveTaskDetails(null)} className="text-gray-400 hover:text-black">✕</button>
                                </div>

                                <div className="mb-6">
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Priority</label>
                                    <div className="flex gap-2">
                                        {[0, 1, 2].map((p) => {
                                            const label = PRIORITY_LABELS[p as 0 | 1 | 2];
                                            const isSelected = activeTaskDetails.priority === p;
                                            const colors = p === 2 ? "bg-red-500 text-white" : p === 1 ? "bg-orange-500 text-white" : "bg-blue-500 text-white";
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setActiveTaskDetails({ ...activeTaskDetails, priority: p })}
                                                    className={cn(
                                                        "flex-1 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all",
                                                        isSelected ? colors + " border-transparent shadow-lg scale-105" : "bg-gray-50 text-gray-400 border-gray-100"
                                                    )}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Category</label>
                                    <div className="flex flex-wrap gap-2">
                                        {processedCategories.map(catTitle => {
                                            const section = sections.find(s => s.title === catTitle);
                                            const isSelected = (activeTaskDetails.section_title || 'Misc') === catTitle;
                                            return (
                                                <button
                                                    key={catTitle}
                                                    onClick={() => setActiveTaskDetails({ ...activeTaskDetails, section_id: section?.id || null, section_title: catTitle })}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase border transition-all",
                                                        isSelected
                                                            ? "bg-black text-white border-black shadow-lg scale-105"
                                                            : "bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200"
                                                    )}
                                                >
                                                    {catTitle}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Note</label>
                                    <textarea
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 ring-black/5 text-gray-700 font-medium"
                                        placeholder="Add details, subtasks, or thoughts..."
                                        value={activeTaskDetails.note || ''}
                                        onChange={e => setActiveTaskDetails({ ...activeTaskDetails, note: e.target.value })}
                                    />
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    <button onClick={() => { handleDeleteTask(activeTaskDetails.id); setActiveTaskDetails(null); }} className="text-red-500 font-bold text-sm px-4 py-2 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2">
                                        <span>🗑️</span> Delete Task
                                    </button>
                                    <button onClick={() => { handleTaskAction('PATCH', { id: activeTaskDetails.id, note: activeTaskDetails.note, section_id: activeTaskDetails.section_id, priority: activeTaskDetails.priority }); setActiveTaskDetails(null); }} className="bg-black text-white font-bold px-8 py-3 rounded-xl text-sm hover:bg-gray-800 transition-colors shadow-lg">
                                        Save Details
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )
                }

                {/* GYM MODAL */}
                {
                    addingType === 'gym_info' && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setAddingType(null)}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[85vh] border dark:border-gray-800" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-bold dark:text-white">Weekly Workout Plan</h3>
                                    <div className="relative group">
                                        <button className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-500 font-serif italic hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-black dark:hover:border-white transition-colors">i</button>
                                        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 shadow-2xl rounded-2xl p-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 translate-y-2 group-hover:translate-y-0 pointer-events-none">
                                            <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3">Daily Routine</h4>
                                            <div className="space-y-3">
                                                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                                                    <span className="font-bold text-black dark:text-white block mb-1">Mon-Fri:</span>
                                                    2.5k Running, Pullups, Plank, Skipping, Pushups, Situps
                                                </p>
                                                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                                                    <span className="font-bold text-black dark:text-white block mb-1">Sat:</span>
                                                    Pullups, Plank, Skipping, Pushups, Situps, Stairs, 500m Incline Walk
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                                        const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
                                        return (
                                            <div key={day} className={cn("p-4 rounded-xl border flex flex-col gap-2 transition-all", isToday ? "bg-black dark:bg-white border-black dark:border-white shadow-lg scale-105 ring-4 ring-black/10 z-10" : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700")}>
                                                <div className="flex justify-between items-center">
                                                    <span className={cn("font-bold text-sm", isToday ? "text-white dark:text-black" : "text-gray-500 dark:text-gray-400")}>{day}</span>
                                                    {isToday && <span className="bg-white dark:bg-black text-black dark:text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Today</span>}
                                                </div>
                                                <input
                                                    value={gymSchedule[day] || ''}
                                                    onChange={e => setGymSchedule({ ...gymSchedule, [day]: e.target.value })}
                                                    className={cn("bg-transparent outline-none font-bold text-lg w-full placeholder-opacity-50", isToday ? "text-white dark:text-black placeholder-gray-400 dark:placeholder-gray-500" : "text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600")}
                                                    placeholder="Rest Day"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                <button onClick={() => setAddingType(null)} className="w-full bg-black text-white dark:bg-white dark:text-black font-bold py-4 rounded-xl text-lg mt-6 shadow-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors">
                                    Save Plan
                                </button>
                            </motion.div>
                        </div>
                    )
                }
                {/* GLOBAL CONFIRMATION MODAL */}
                {
                    confirmConfig.isOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-gray-900 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border dark:border-gray-800" onClick={e => e.stopPropagation()}>
                                <h3 className="text-2xl font-bold mb-2 dark:text-white">{confirmConfig.title}</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">{confirmConfig.message}</p>
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => {
                                            confirmConfig.onConfirm();
                                            setConfirmConfig({ ...confirmConfig, isOpen: false });
                                        }}
                                        className="w-full bg-black text-white dark:bg-white dark:text-black font-bold py-4 rounded-xl text-lg hover:opacity-90 transition-opacity"
                                    >
                                        {confirmConfig.isAlert ? 'Got it' : 'Confirm'}
                                    </button>
                                    {!confirmConfig.isAlert && (
                                        <button
                                            onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
                                            className="w-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold py-4 rounded-xl text-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >
        </div >
    );
}

const DashboardCard = React.memo(function DashboardCard({ habit, onToggle, onUpdateLog, isNoteOpen, onToggleNote, onEdit, onDelete, cardioInfo }: any) {
    const theme = COLOR_MAP[habit.color] || COLOR_MAP['purple'];
    const checked = !!habit.completed;

    return (
        <div className={cn("rounded-[2.5rem] p-5 relative transition-all duration-300 border-2 h-full flex flex-col justify-between group", checked ? "bg-white border-black/10 shadow-sm dark:bg-gray-900 dark:border-gray-800" : "bg-white border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md dark:bg-gray-900 dark:border-gray-800")}>
            <div className="absolute top-4 right-4 flex gap-2 z-10">
                {cardioInfo && (
                    <div className="relative group/info">
                        <button className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 font-serif italic hover:bg-black hover:text-white hover:border-black transition-colors text-[10px]">i</button>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 text-white text-[10px] p-3 rounded-xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-20 pointer-events-none">
                            <p className="font-bold mb-1 uppercase tracking-widest text-[#ffffff66]">Cardio Routine</p>
                            <div className="whitespace-pre-wrap leading-relaxed">
                                {cardioInfo}
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onEdit} className="text-gray-300 hover:text-black">✎</button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-gray-300 hover:text-red-500">🗑️</button>
                </div>
            </div>
            <div>
                <div className="flex items-start gap-3 mb-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner flex-shrink-0", theme.iconBg)}>{habit.icon || '📍'}</div>
                    {!!habit.track_streak && (
                        <div className="font-bold text-orange-500 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-lg text-xs border border-orange-100">
                            🔥 {habit.streak || 0}
                        </div>
                    )}
                </div>
                <div className="mb-4">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white mb-0.5">{habit.title}</h3>
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500">{habit.subtitle}</p>
                        {!!habit.track_streak && !checked && habit.streak_expires_at && (
                            <StreakTimer expiresAt={habit.streak_expires_at} isAtRisk={habit.streak_at_risk} />
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-1 border border-gray-100 dark:border-gray-700 w-20">
                        <span className="text-[10px] text-gray-400">⏱</span>
                        <input type="number" value={habit.time_spent || ''} onChange={e => onUpdateLog({ time_spent: parseInt(e.target.value) || 0 })} placeholder="0" className="bg-transparent w-full text-xs font-bold text-gray-900 dark:text-white outline-none text-right" />
                        <span className="text-[10px] text-gray-400 font-medium">m</span>
                    </div>
                    <button onClick={onToggleNote} className={cn("p-1.5 rounded-lg border transition-colors", habit.log_note ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300")}>📝</button>
                </div>
                <AnimatePresence>
                    {isNoteOpen && (
                        <motion.textarea initial={{ height: 0, opacity: 0, marginBottom: 0 }} animate={{ height: '60px', opacity: 1, marginBottom: '16px' }} exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                            value={habit.log_note || ''} onChange={e => onUpdateLog({ note: e.target.value })} placeholder="Add quick note..." className="w-full bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-xl p-2 text-xs font-medium resize-none focus:outline-none focus:bg-yellow-50 dark:focus:bg-yellow-900/20 text-gray-700 dark:text-gray-300"
                        />
                    )}
                </AnimatePresence>
            </div>
            <button onClick={onToggle} className={cn("w-full py-3 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2", checked ? "bg-black text-white dark:bg-gray-700 shadow-lg" : theme.bg + " " + theme.text + " " + theme.border + " border")}>
                {checked ? "COMPLETED" : "MARK DONE"}
                {checked && <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
        </div>
    );
});

function SideCard({ habit, onClick, onToggle }: any) {
    const theme = COLOR_MAP[habit.color] || COLOR_MAP['purple'];
    const checked = !!habit.completed;
    return (
        <div className={cn("p-3 rounded-2xl border flex items-center gap-3 bg-white transition-all cursor-pointer hover:shadow-md", checked ? "opacity-60 grayscale border-gray-100" : "border-gray-100")}>
            <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors", checked ? "bg-black border-black" : "border-gray-200 hover:border-gray-400")}>
                {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
            <div className="flex-1 min-w-0" onClick={onClick}>
                <p className="font-bold text-sm text-gray-900 truncate">{habit.title}</p>
                <p className="text-[10px] text-gray-400 truncate">{habit.subtitle}</p>
            </div>
            <div className="text-lg opacity-50">{habit.icon}</div>
        </div>
    );
}

const TaskCard = React.memo(function TaskCard({ task, onToggle, onClick, onDelete, onMove, compact }: any) {
    const priorityColor = task.completed ? 'bg-gray-200 dark:bg-gray-700' : (PRIORITY_LABELS[task.priority as 0 | 1 | 2] === 'HIGH' ? 'bg-red-500' : PRIORITY_LABELS[task.priority as 0 | 1 | 2] === 'MED' ? 'bg-orange-500' : 'bg-blue-500');

    return (
        <motion.div
            layout
            drag={!compact && !!onMove}
            dragSnapToOrigin
            dragElastic={0.1}
            whileDrag={{ scale: 1.05, zIndex: 50, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)", pointerEvents: 'none' }}
            onDragEnd={(e: any, info: any) => {
                if (!onMove) return;
                const element = document.elementFromPoint(info.point.x, info.point.y);
                const dropZone = element?.closest('[data-section]');
                if (dropZone) {
                    const newCat = dropZone.getAttribute('data-section');
                    const rect = dropZone.getBoundingClientRect();
                    const relativeY = info.point.y - rect.top;
                    const percentY = relativeY / rect.height;

                    let newPriority = 0;
                    if (percentY < 0.33) newPriority = 2; // HIGH
                    else if (percentY < 0.66) newPriority = 1; // MED
                    else newPriority = 0; // LOW

                    const isSameCat = newCat === (task.section_title || 'Misc');
                    if (!isSameCat || newPriority !== task.priority) {
                        onMove(task.id, newCat || 'Misc', newPriority);
                    }
                }
            }}
            onClick={onClick}
            className={cn(
                "bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing flex items-center gap-3 group touch-none",
                compact && "py-2 bg-transparent border-none shadow-none hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            )}
        >
            {!compact && onMove && (
                <div className="text-[10px] text-gray-300 group-hover:text-gray-400 transition-colors">⠿</div>
            )}
            <button onClick={(e) => { e.stopPropagation(); onToggle(task.id, !task.completed); }} className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors", task.completed ? "bg-black dark:bg-gray-600 border-black dark:border-gray-600" : "border-gray-200 dark:border-gray-600 hover:border-gray-400")}>
                {task.completed && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full", priorityColor)} />
                    <p className={cn("font-bold text-sm truncate", task.completed ? "text-gray-400 line-through" : "text-gray-900 dark:text-white")}>{task.title}</p>
                </div>
                {!compact && task.note && <p className="text-xs text-gray-400 dark:text-gray-500 truncate pl-3.5">{task.note}</p>}
            </div>
            {!!task.estimated_time && !task.completed && <div className="text-[10px] font-bold text-gray-400 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-600">{task.estimated_time}m</div>}
            {onDelete && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="text-gray-300 hover:text-red-500 transition-colors px-2 relative z-10"
                    title="Delete Task"
                >
                    🗑️
                </button>
            )}
        </motion.div>
    );
});

const StreakTimer = ({ expiresAt, isAtRisk }: { expiresAt: string, isAtRisk: boolean }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculate = () => {
            const now = new Date();
            const end = new Date(expiresAt);
            const diff = end.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft('Expired');
                return;
            }

            const h = Math.floor(diff / (1000 * 3600));
            const m = Math.floor((diff % (1000 * 3600)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft(`${h}h ${m}m ${s}s`);
        };

        calculate();
        const timer = setInterval(calculate, 1000);
        return () => clearInterval(timer);
    }, [expiresAt]);

    if (timeLeft === 'Expired') return null;

    return (
        <span className={cn(
            "text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 transition-all",
            isAtRisk ? "bg-red-100 text-red-600 animate-pulse ring-2 ring-red-500/20" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
        )}>
            {isAtRisk && <span>⌛</span>}
            {timeLeft}
        </span>
    );
};
