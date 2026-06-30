"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AlertCircle, Plus, Trash2, RefreshCw, Users, BookOpen, Layers, DoorOpen, Link2, X, Download } from 'lucide-react';
import axios from 'axios';

const HF_API = process.env.NEXT_PUBLIC_TIMETABLE_API_URL || 'https://kindalien-timetable-gen.hf.space';

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
        { name: 'Rule Type', key: 'rule_type', type: 'select', options: ['FIXED_PERIOD', 'BEFORE_TIME', 'FIXED_DAYS', 'FACULTY_UNAVAILABLE'] },
        { name: 'Faculty ID', key: 'faculty_id', type: 'text' },
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
    const [allFaculties, setAllFaculties] = useState<any[]>([]);
    const [allSections, setAllSections] = useState<any[]>([]);
    const [allAllocations, setAllAllocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [editItem, setEditItem] = useState<any>(null);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [uploadingExcel, setUploadingExcel] = useState(false);

    // Smart Search & Modal State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEntity, setSelectedEntity] = useState<{ type: 'faculty' | 'subject' | 'section', id: string } | null>(null);

    const fetchData = async (entity: EntityKey) => {
        setLoading(true);
        try {
            // Also fetch subjects in parallel to populate dropdowns
            const [mainRes, subRes, facRes, secRes, allocRes] = await Promise.all([
                axios.get(`${HF_API}/${entity === 'scheduling_rules' ? 'scheduling-rules' : `data/${entity}`}`),
                axios.get(`${HF_API}/data/subjects`),
                axios.get(`${HF_API}/data/faculties`),
                axios.get(`${HF_API}/data/sections`),
                axios.get(`${HF_API}/data/allocations`)
            ]);
            setItems(mainRes.data[entity === 'scheduling_rules' ? 'rules' : entity] || []);
            setEditItem(null);
            setEditIndex(null);
            setSearchQuery('');
            setAllSubjects(subRes.data.subjects || []);
            setAllFaculties(facRes.data.faculties || []);
            setAllSections(secRes.data.sections || []);
            setAllAllocations(allocRes.data.allocations || []);
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


    const handleDownloadTemplate = () => {
        window.open(`${HF_API}/data/template/excel`, '_blank');
    };

    const handleDownloadData = () => {
        window.open(`${HF_API}/data/export/excel`, '_blank');
    };

    const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploadingExcel(true);
        try {
            await axios.post(`${HF_API}/data/import/excel`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Excel data imported successfully!');
            await fetchData(activeTab);
        } catch (err: any) {
            console.error('Excel import failed', err);
            alert(err.response?.data?.error || 'Failed to import Excel file');
        } finally {
            setUploadingExcel(false);
            e.target.value = ''; // reset input
        }
    };

    const handleEditClick = (index: number, item: any) => {
        setEditItem(item);
        setEditIndex(index);

        // Populate formData based on activeTab
        const newFormData: Record<string, any> = { ...item };
        if (activeTab === 'scheduling_rules' && item.period_index !== undefined) {
            newFormData.period_index = `Period ${item.period_index + 1}`;
        }
        if (activeTab === 'scheduling_rules' && item.max_period_index !== undefined) {
            newFormData.max_period_index = `Period ${item.max_period_index + 1}`;
        }
        setFormData(newFormData);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditItem(null);
        setEditIndex(null);
        setFormData({});
    };

    const calculateWorkload = (facultyId: string, customAllocations?: any[]) => {
        let hours = 0;
        const uniqueClasses = new Set<string>();
        const allocsToUse = customAllocations || allAllocations;

        allocsToUse.forEach(alloc => {
            if (alloc.faculty_id === facultyId) {
                // Consider 6A-E1 and 6A-E2 as the same class "6a" for a given subject
                const baseSection = alloc.section_id ? alloc.section_id.split('-')[0].toLowerCase().trim() : '';
                const classKey = `${alloc.subject_code}-${baseSection}`;

                if (!uniqueClasses.has(classKey)) {
                    uniqueClasses.add(classKey);
                    const sub = allSubjects.find(s => s.code === alloc.subject_code);
                    if (sub) {
                        hours += sub.credits;
                    }
                }
            }
        });
        return hours;
    };

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
            if (item.rule_type !== 'FACULTY_UNAVAILABLE') delete item.faculty_id;
            
            if (item.rule_type === 'FACULTY_UNAVAILABLE') {
                delete item.subject_codes;
                delete item.subject_types;
                delete item.max_period_index;
                // period_index and days are used
            } else {
                if (item.rule_type !== 'FIXED_PERIOD') delete item.period_index;
                if (item.rule_type !== 'BEFORE_TIME') delete item.max_period_index;
                if (item.rule_type !== 'FIXED_DAYS') delete item.days;
            }
        }

        // Instant Conflict Warning
        if (activeTab === 'allocations') {
            const faculty = allFaculties.find(f => f.id === item.faculty_id);
            if (faculty) {
                const newSub = allSubjects.find(s => s.code === item.subject_code);

                // Simulate new load
                const simulatedAllocations = [...allAllocations];
                if (editItem) {
                    // Try to find and replace the old item
                    const idx = simulatedAllocations.findIndex(a =>
                        a.faculty_id === editItem.faculty_id &&
                        a.subject_code === editItem.subject_code &&
                        a.section_id === editItem.section_id
                    );
                    if (idx !== -1) {
                        simulatedAllocations[idx] = item;
                    } else {
                        simulatedAllocations.push(item);
                    }
                } else {
                    simulatedAllocations.push(item);
                }

                const newLoad = calculateWorkload(item.faculty_id, simulatedAllocations);

                if (newLoad > faculty.max_hours) {
                    if (!confirm(`Warning: Allocating ${newSub?.name || item.subject_code} to ${faculty.name} will exceed their max limit of ${faculty.max_hours} hours (New load: ${newLoad}). Proceed anyway?`)) {
                        return;
                    }
                }
            }
        }

        try {
            if (editItem) {
                // Determine PUT URL
                let url = '';
                if (activeTab === 'scheduling_rules') {
                    url = `${HF_API}/scheduling-rules/${editItem.id}`;
                } else if (activeTab === 'allocations') {
                    url = `${HF_API}/data/allocations/${editIndex}`;
                } else if (activeTab === 'subjects') {
                    url = `${HF_API}/data/subjects/${editItem.code}`;
                } else {
                    url = `${HF_API}/data/${activeTab}/${editItem.id}`;
                }
                await axios.put(url, item);
                setEditItem(null);
                setEditIndex(null);
            } else {
                const endpoint = activeTab === 'scheduling_rules' ? 'scheduling-rules' : `data/${activeTab}`;
                await axios.post(`${HF_API}/${endpoint}`, item);
            }
            // Refresh list after add/update
            await fetchData(activeTab);
            setFormData({});
        } catch (err: any) {
            console.error('Operation failed', err);
            alert(err.response?.data?.error || 'Failed to save item');
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

    const filteredItems = items.filter(item => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return Object.values(item).some(val =>
            String(val).toLowerCase().includes(query)
        );
    });

    const fields = ENTITY_FIELDS[activeTab];

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">⚙️ Manage Timetable Data</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Add, view, and remove faculties, subjects, sections, rooms, and allocations
                </p>
            </div>


            {/* Excel Import/Export */}
            <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-semibold text-blue-900">Bulk Import Data</h3>
                        <p className="text-xs text-blue-700 mt-1">Download the Excel template, fill it out, and upload it to replace existing data.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleDownloadTemplate} className="text-xs px-3 py-1.5 bg-white text-blue-600 font-medium border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
                            Download Template
                        </button>
                        <label className={`cursor-pointer text-xs px-3 py-1.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm ${uploadingExcel ? 'opacity-50 pointer-events-none' : ''}`}>
                            {uploadingExcel ? 'Uploading...' : 'Upload Excel'}
                            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUploadExcel} disabled={uploadingExcel} />
                        </label>
                    </div>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-semibold text-green-900">Export Existing Data</h3>
                        <p className="text-xs text-green-700 mt-1">Download all current data (faculties, subjects, sections, rooms, allocations, and scheduling rules) as an Excel file.</p>
                    </div>
                    <button onClick={handleDownloadData} className="flex items-center gap-2 text-xs px-3 py-1.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm shrink-0">
                        <Download className="w-3.5 h-3.5" />
                        Download Data
                    </button>
                </div>
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
                            if (f.key === 'faculty_id' && rtype !== 'FACULTY_UNAVAILABLE') return null;
                            if (f.key === 'subject_codes' && rtype === 'FACULTY_UNAVAILABLE') return null;
                            if (f.key === 'subject_types' && rtype === 'FACULTY_UNAVAILABLE') return null;
                            if (f.key === 'period_index' && rtype !== 'FIXED_PERIOD' && rtype !== 'FACULTY_UNAVAILABLE') return null;
                            if (f.key === 'max_period_index' && rtype !== 'BEFORE_TIME') return null;
                            if (f.key === 'days' && rtype !== 'FIXED_DAYS' && rtype !== 'FACULTY_UNAVAILABLE') return null;
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
                                    <>
                                        <input type={f.type} value={formData[f.key] || ''}
                                            list={`${f.key}-datalist`}
                                            onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                                            className={`w-full rounded-lg border border-gray-300 p-2 text-sm ${editItem && (f.key === 'id' || f.key === 'code') ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                            placeholder={f.name}
                                            disabled={!!editItem && (f.key === 'id' || f.key === 'code')} />

                                        {/* Smart Autocomplete Datalists */}
                                        {f.key === 'faculty_id' && (
                                            <datalist id={`${f.key}-datalist`}>
                                                {allFaculties.map(fac => <option key={fac.id} value={fac.id}>{fac.name} ({fac.designation})</option>)}
                                            </datalist>
                                        )}
                                        {f.key === 'subject_code' && (
                                            <datalist id={`${f.key}-datalist`}>
                                                {allSubjects.map(sub => <option key={sub.code} value={sub.code}>{sub.name}</option>)}
                                            </datalist>
                                        )}
                                        {f.key === 'section_id' && (
                                            <datalist id={`${f.key}-datalist`}>
                                                {allSections.map(sec => <option key={sec.id} value={sec.id}>Semester {sec.semester}</option>)}
                                            </datalist>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="flex items-center gap-2 mt-4">
                    <button onClick={handleAdd}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                        <Plus className="w-4 h-4" /> {editItem ? `Update ${activeTab.slice(0, -1)}` : `Add ${activeTab.slice(0, -1)}`}
                    </button>
                    {editItem && (
                        <button onClick={handleCancelEdit}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                            Cancel Edit
                        </button>
                    )}
                </div>

            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-gray-100 gap-4">
                    <h3 className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                        {filteredItems.length} {activeTab} loaded {searchQuery && '(filtered)'}
                    </h3>

                    {/* Search Bar */}
                    <div className="relative w-full sm:max-w-xs">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder={`Search ${activeTab}...`}
                            className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors bg-gray-50/50"
                        />
                    </div>

                    {items.length > 0 && (
                        <button onClick={handleClearAll}
                            className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1 shrink-0">
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
                                    {activeTab === 'faculties' && (
                                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Workload</th>
                                    )}
                                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                                        {fields.map(f => (
                                            <td key={f.key} className="px-4 py-2.5 text-gray-800">
                                                {/* Smart Click-to-View Links for Allocations */}
                                                {activeTab === 'allocations' && ['faculty_id', 'subject_code', 'section_id'].includes(f.key) ? (
                                                    <button onClick={() => setSelectedEntity({ type: f.key.split('_')[0] as any, id: String(item[f.key]) })}
                                                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium focus:outline-none transition-colors">
                                                        {String(item[f.key] ?? '')}
                                                    </button>
                                                ) : f.type === 'checkbox'
                                                    ? (item[f.key] ? '✅' : '❌')
                                                    : Array.isArray(item[f.key])
                                                        ? item[f.key].join(', ')
                                                        : String(item[f.key] ?? '')}
                                            </td>
                                        ))}
                                        {/* Workload Progress Bar for Faculties */}
                                        {activeTab === 'faculties' && (
                                            <td className="px-4 py-2.5">
                                                {(() => {
                                                    const load = calculateWorkload(item.id);
                                                    const max = item.max_hours || 18;
                                                    const percentage = Math.min(100, Math.round((load / max) * 100));
                                                    const color = percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500';
                                                    return (
                                                        <button
                                                            onClick={() => setSelectedEntity({ type: 'faculty', id: item.id })}
                                                            className="w-32 text-left hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1 -ml-1"
                                                            title="Click to view allocations"
                                                        >
                                                            <div className="flex justify-between text-[10px] mb-1">
                                                                <span className={percentage >= 100 ? 'text-red-600 font-bold' : 'text-gray-500'}>{load} / {max} hrs</span>
                                                                <span className="text-gray-400 font-medium">{percentage}%</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                                <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
                                                            </div>
                                                        </button>
                                                    );
                                                })()}
                                            </td>
                                        )}
                                        <td className="px-4 py-2.5 text-center flex items-center justify-center gap-2">
                                            <button onClick={() => handleEditClick(items.indexOf(item), item)}
                                                className="text-blue-500 hover:text-blue-700 transition-colors" title="Edit">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                            <button onClick={() => handleDelete(items.indexOf(item), item)}
                                                className="text-red-500 hover:text-red-700 transition-colors" title="Delete">
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

            {/* Quick View Modal */}
            {selectedEntity && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedEntity(null)} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={() => setSelectedEntity(null)} className="absolute top-4 right-4 p-1.5 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors">
                            <X className="w-4 h-4" />
                        </button>

                        {(() => {
                            if (selectedEntity.type === 'faculty') {
                                const f = allFaculties.find(x => x.id === selectedEntity.id);
                                if (!f) return <p className="text-gray-500">Faculty not found.</p>;
                                const load = calculateWorkload(f.id);
                                return (
                                    <>
                                        <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                                <Users className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-800">{f.name}</h3>
                                                <p className="text-sm text-gray-500">{f.id} • {f.designation}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Current Workload</p>
                                                <p className="text-lg font-bold text-gray-800">{load} <span className="text-sm font-medium text-gray-500">/ {f.max_hours || 18} hrs</span></p>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Allocated Subjects</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {allAllocations.filter(a => a.faculty_id === f.id).map((a, i) => (
                                                        <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded shadow-sm text-xs font-medium text-gray-600">
                                                            {a.subject_code} ({a.section_id})
                                                        </span>
                                                    ))}
                                                    {allAllocations.filter(a => a.faculty_id === f.id).length === 0 && <span className="text-sm text-gray-400">No allocations yet</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            }
                            if (selectedEntity.type === 'subject') {
                                const s = allSubjects.find(x => x.code === selectedEntity.id);
                                if (!s) return <p className="text-gray-500">Subject not found.</p>;
                                return (
                                    <>
                                        <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                                                <BookOpen className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-800">{s.name}</h3>
                                                <p className="text-sm text-gray-500">{s.code} • {s.type}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Credits</p>
                                                <p className="text-lg font-bold text-gray-800">{s.credits}</p>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Tags</p>
                                                <div className="flex gap-2 flex-wrap mt-1">
                                                    {s.is_core ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">CORE</span> : <span className="text-sm text-gray-400">-</span>}
                                                    {s.is_heavy && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-bold">HEAVY</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            }
                            if (selectedEntity.type === 'section') {
                                const sec = allSections.find(x => x.id === selectedEntity.id);
                                if (!sec) return <p className="text-gray-500">Section not found.</p>;
                                return (
                                    <>
                                        <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
                                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                                                <Layers className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-800">Section {sec.id}</h3>
                                                <p className="text-sm text-gray-500">Semester {sec.semester}</p>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Strength</p>
                                            <p className="text-lg font-bold text-gray-800">{sec.strength} <span className="text-sm font-medium text-gray-500">Students</span></p>
                                        </div>
                                    </>
                                );
                            }
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
