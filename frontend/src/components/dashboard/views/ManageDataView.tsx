"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, Plus, Trash2, RefreshCw, Users, BookOpen, Layers, DoorOpen, Link2 } from 'lucide-react';
import axios from 'axios';

const HF_API = 'https://kindalien-timetable-gen.hf.space';

const TABS = [
    { key: 'faculties', label: 'Faculties', icon: Users },
    { key: 'subjects', label: 'Subjects', icon: BookOpen },
    { key: 'sections', label: 'Sections', icon: Layers },
    { key: 'rooms', label: 'Rooms', icon: DoorOpen },
    { key: 'allocations', label: 'Allocations', icon: Link2 },
    { key: 'scheduling_rules', label: 'Scheduling Rules', icon: RefreshCw },
] as const;

type EntityKey = typeof TABS[number]['key'];

const ENTITY_FIELDS: Record<EntityKey, { name: string; key: string; type: string; options?: string[] }[]> = {
    faculties: [
        { name: 'ID (e.g. F001)', key: 'id', type: 'text' },
        { name: 'Name', key: 'name', type: 'text' },
        { name: 'Designation', key: 'designation', type: 'select', options: ['Professor', 'Assoc. Prof', 'Asst. Prof', 'Guest'] },
        { name: 'Max Hours/Week', key: 'max_hours', type: 'number' },
    ],
    subjects: [
        { name: 'Code', key: 'code', type: 'text' },
        { name: 'Name', key: 'name', type: 'text' },
        { name: 'Type', key: 'type', type: 'select', options: ['THEORY', 'LAB', 'SOFTSKILL', 'FORUM'] },
        { name: 'Credits', key: 'credits', type: 'number' },
        { name: 'Is Core?', key: 'is_core', type: 'checkbox' },
        { name: 'Is Heavy?', key: 'is_heavy', type: 'checkbox' },
    ],
    sections: [
        { name: 'Section ID (e.g. 6A)', key: 'id', type: 'text' },
        { name: 'Semester', key: 'semester', type: 'number' },
        { name: 'Student Strength', key: 'strength', type: 'number' },
    ],
    rooms: [
        { name: 'Room ID', key: 'id', type: 'text' },
        { name: 'Capacity', key: 'capacity', type: 'number' },
        { name: 'Is Lab?', key: 'is_lab', type: 'checkbox' },
        { name: 'Building', key: 'building', type: 'text' },
    ],
    allocations: [
        { name: 'Faculty ID', key: 'faculty_id', type: 'text' },
        { name: 'Subject Code', key: 'subject_code', type: 'text' },
        { name: 'Section ID', key: 'section_id', type: 'text' },
        { name: 'Elective Group (Optional)', key: 'elective_group', type: 'text' },
    ],
    scheduling_rules: [
        { name: 'Rule Type', key: 'rule_type', type: 'select', options: ['FIXED_PERIOD', 'BEFORE_TIME', 'FIXED_DAYS'] },
        { name: 'Subject Codes', key: 'subject_codes', type: 'multiselect' }, // dynamically populated
        { name: 'Subject Types', key: 'subject_types', type: 'multiselect', options: ['THEORY', 'LAB', 'SOFTSKILL', 'FORUM'] },
        { name: 'Period', key: 'period_index', type: 'select', options: ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Period 7', 'Period 8'] },
        { name: 'Max Period', key: 'max_period_index', type: 'select', options: ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6', 'Period 7', 'Period 8'] },
        { name: 'Days', key: 'days', type: 'multiselect', options: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] },
    ],
};

export function ManageDataView() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<EntityKey>('faculties');
    const [items, setItems] = useState<any[]>([]);
    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState<Record<string, any>>({});

    const fetchData = async (entity: EntityKey) => {
        setLoading(true);
        try {
            // Also fetch subjects in parallel to populate dropdowns
            const [mainRes, subRes] = await Promise.all([
                axios.get(`${HF_API}/${entity === 'scheduling_rules' ? 'scheduling-rules' : `data/${entity}`}`),
                axios.get(`${HF_API}/data/subjects`)
            ]);
            setItems(mainRes.data[entity === 'scheduling_rules' ? 'rules' : entity] || []);
            setAllSubjects(subRes.data.subjects || []);
        } catch (err) {
            console.error('Failed to load', err);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && ['ADMIN', 'SUPER_TEACHER'].includes(user.role)) {
            fetchData(activeTab);
            setFormData({});
        }
    }, [activeTab, user]);

    if (!user || !['ADMIN', 'SUPER_TEACHER'].includes(user.role)) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold text-gray-800">Access Denied</h3>
            </div>
        );
    }

    const handleAdd = async () => {
        const fields = ENTITY_FIELDS[activeTab];
        const item: Record<string, any> = {};
        for (const f of fields) {
            if (f.type === 'number') {
                item[f.key] = parseInt(formData[f.key]) || (f.key === 'max_hours' ? 18 : f.key === 'credits' ? 3 : f.key === 'capacity' ? 80 : f.key === 'strength' ? 60 : f.key === 'semester' ? 6 : 1);
            } else if (f.type === 'checkbox') {
                item[f.key] = !!formData[f.key];
            } else if (f.type === 'multiselect') {
                item[f.key] = formData[f.key] || [];
            } else if (f.type === 'select' && f.key.includes('period_index')) {
                // Convert "Period 1" -> 0, "Period 2" -> 1, etc.
                const val = formData[f.key] || (f.options ? f.options[0] : 'Period 1');
                item[f.key] = parseInt(val.replace('Period ', '')) - 1;
            } else {
                item[f.key] = formData[f.key] || (f.options ? f.options[0] : '');
            }
        }
        // For allocations, send null for empty elective_group
        if (activeTab === 'allocations' && !item.elective_group) {
            item.elective_group = null;
        }

        // For scheduling rules, arrays are already properly typed via multiselect
        if (activeTab === 'scheduling_rules') {
            // Cleanup unused fields based on type to keep JSON clean
            if (item.rule_type !== 'FIXED_PERIOD') delete item.period_index;
            if (item.rule_type !== 'BEFORE_TIME') delete item.max_period_index;
            if (item.rule_type !== 'FIXED_DAYS') delete item.days;
        }

        try {
            const endpoint = activeTab === 'scheduling_rules' ? 'scheduling-rules' : `data/${activeTab}`;
            const res = await axios.post(`${HF_API}/${endpoint}`, item);
            // Refresh list after add
            await fetchData(activeTab);
            setFormData({});
        } catch (err: any) {
            console.error('Add failed', err);
            alert(err.response?.data?.error || 'Failed to add item');
        }
    };

    const handleDelete = async (index: number, item: any) => {
        try {
            // The HF API needs the ID for entities, and index for allocations
            let url = '';
            if (activeTab === 'scheduling_rules') {
                url = `${HF_API}/scheduling-rules/${item.id}`;
            } else {
                url = `${HF_API}/data/${activeTab}`;
                if (activeTab === 'allocations') {
                    url += `/${index}`;
                } else if (activeTab === 'subjects') {
                    url += `/${item.code}`;
                } else {
                    url += `/${item.id}`;
                }
            }

            await axios.delete(url);
            await fetchData(activeTab);
        } catch (err: any) {
            console.error('Delete failed', err);
            alert(err.response?.data?.error || 'Failed to delete item');
        }
    };

    const handleClearAll = async () => {
        if (!confirm(`Are you sure you want to clear ALL ${activeTab}?`)) return;
        try {
            await axios.delete(`${HF_API}/data/${activeTab}`);
            await fetchData(activeTab);
        } catch (err: any) {
            console.error('Clear failed', err);
        }
    };

    const fields = ENTITY_FIELDS[activeTab];

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">⚙️ Manage Timetable Data</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Add, view, and remove faculties, subjects, sections, rooms, and allocations
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 overflow-x-auto">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <Icon className="w-4 h-4" /> {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Add Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Add {activeTab.slice(0, -1)}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {fields.map(f => {
                        // Dynamically hide/show fields for scheduling rules
                        if (activeTab === 'scheduling_rules') {
                            const rtype = formData.rule_type || 'FIXED_PERIOD';
                            if (f.key === 'period_index' && rtype !== 'FIXED_PERIOD') return null;
                            if (f.key === 'max_period_index' && rtype !== 'BEFORE_TIME') return null;
                            if (f.key === 'days' && rtype !== 'FIXED_DAYS') return null;
                        }

                        let options = f.options || [];
                        if (f.key === 'subject_codes') {
                            options = allSubjects.map(s => s.code);
                        }

                        return (
                            <div key={f.key}>
                                <label className="block text-xs text-gray-600 mb-1">{f.name}</label>
                                {f.type === 'select' ? (
                                    <select value={formData[f.key] || options[0] || ''}
                                        onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 border p-2 text-sm">
                                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ) : f.type === 'multiselect' ? (
                                    <select multiple value={formData[f.key] || []}
                                        onChange={(e) => {
                                            const values = Array.from(e.target.selectedOptions, option => option.value);
                                            setFormData({ ...formData, [f.key]: values });
                                        }}
                                        className="w-full rounded-lg border-gray-300 border p-2 text-sm h-24">
                                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                ) : f.type === 'checkbox' ? (
                                    <label className="flex items-center gap-2 mt-1">
                                        <input type="checkbox" checked={!!formData[f.key]}
                                            onChange={(e) => setFormData({ ...formData, [f.key]: e.target.checked })}
                                            className="rounded border-gray-300 text-blue-600" />
                                        <span className="text-sm text-gray-700">{f.name}</span>
                                    </label>
                                ) : (
                                    <input type={f.type} value={formData[f.key] || ''}
                                        onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 border p-2 text-sm"
                                        placeholder={f.name} />
                                )}
                            </div>
                        );
                    })}
                </div>
                <button onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    <Plus className="w-4 h-4" /> Add {activeTab.slice(0, -1)}
                </button>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="text-sm font-semibold text-gray-700">
                        {items.length} {activeTab} loaded
                    </h3>
                    {items.length > 0 && (
                        <button onClick={handleClearAll}
                            className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1">
                            <Trash2 className="w-3.5 h-3.5" /> Clear All
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center items-center p-8">
                        <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">No {activeTab} found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50">
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                                    {fields.map(f => (
                                        <th key={f.key} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">
                                            {f.name.split('(')[0].trim()}
                                        </th>
                                    ))}
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                                        {fields.map(f => (
                                            <td key={f.key} className="px-4 py-2.5 text-gray-800">
                                                {f.type === 'checkbox' 
                                                    ? (item[f.key] ? '✅' : '❌') 
                                                    : Array.isArray(item[f.key]) 
                                                        ? item[f.key].join(', ') 
                                                        : String(item[f.key] ?? '')}
                                            </td>
                                        ))}
                                        <td className="px-4 py-2.5 text-center">
                                            <button onClick={() => handleDelete(i, item)}
                                                className="text-red-500 hover:text-red-700 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
