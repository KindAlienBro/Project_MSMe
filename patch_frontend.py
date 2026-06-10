import sys
import re

with open('frontend/src/components/dashboard/views/ManageDataView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add states
states_injection = '''    const [editItem, setEditItem] = useState<any>(null);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [uploadingExcel, setUploadingExcel] = useState(false);'''

content = content.replace('    const [formData, setFormData] = useState<Record<string, any>>({});', '    const [formData, setFormData] = useState<Record<string, any>>({});\n' + states_injection)

# Modify fetchData to reset edit states
fetchData_injection = '''            setEditItem(null);
            setEditIndex(null);'''
content = content.replace('            setItems(mainRes.data[entity === \'scheduling_rules\' ? \'rules\' : entity] || []);', '            setItems(mainRes.data[entity === \'scheduling_rules\' ? \'rules\' : entity] || []);\n' + fetchData_injection)

# Add Excel handlers
excel_handlers = '''
    const handleDownloadTemplate = () => {
        window.open(`${HF_API}/data/template/excel`, '_blank');
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
'''

if 'handleDownloadTemplate' not in content:
    content = content.replace('    const handleAdd = async () => {', excel_handlers + '\n    const handleAdd = async () => {')

# Update handleAdd logic for PUT
put_logic = '''
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
'''

content = re.sub(r'        try \{\s+const endpoint = activeTab.*?setFormData\(\{\}\);\s+\} catch \(err: any\) \{.*?\}', put_logic, content, flags=re.DOTALL)

# Add Excel UI above Tabs
excel_ui = '''
            {/* Excel Import/Export */}
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
'''
if 'Bulk Import Data' not in content:
    content = content.replace('{/* Tabs */}', excel_ui + '\n            {/* Tabs */}')

# Add Edit/Cancel buttons
add_button_ui = '''
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
'''
content = re.sub(r'\s*<button onClick=\{handleAdd\}.*?</button>', add_button_ui, content, flags=re.DOTALL)

# Add Edit icon to table
edit_icon_svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>'''
table_actions = f'''                                        <td className="px-4 py-2.5 text-center flex items-center justify-center gap-2">
                                            <button onClick={{() => handleEditClick(i, item)}}
                                                className="text-blue-500 hover:text-blue-700 transition-colors" title="Edit">
                                                {edit_icon_svg}
                                            </button>
                                            <button onClick={{() => handleDelete(i, item)}}
                                                className="text-red-500 hover:text-red-700 transition-colors" title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>'''
content = re.sub(r'\s*<td className="px-4 py-2\.5 text-center">\s*<button onClick=\{\(\) => handleDelete.*?</td>', '\n' + table_actions, content, flags=re.DOTALL)

# Disable ID fields when editing
input_disabled_logic = '''
                                    <input type={f.type} value={formData[f.key] || ''}
                                        onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                                        className={`w-full rounded-lg border border-gray-300 p-2 text-sm ${editItem && (f.key === 'id' || f.key === 'code' || (activeTab === 'allocations' && f.key === 'faculty_id')) ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                        placeholder={f.name} 
                                        disabled={!!editItem && (f.key === 'id' || f.key === 'code' || (activeTab === 'allocations' && f.key === 'faculty_id'))} />
'''
content = re.sub(r'\s*<input type=\{f\.type\}.*?placeholder=\{f\.name\} />', input_disabled_logic, content, flags=re.DOTALL)

with open('frontend/src/components/dashboard/views/ManageDataView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("ManageDataView updated successfully.")
