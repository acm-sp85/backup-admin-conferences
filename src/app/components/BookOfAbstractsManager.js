'use client';
import { useState, useEffect } from 'react';
import { getAbstractsData, saveBookOfAbstractsState } from '../actions/abstracts';
import { GripVertical, ArrowUp, ArrowDown, FileDown, Loader2, Trash2, Undo2, Printer } from 'lucide-react';
import { generateBookOfAbstractsDOCX } from './BookOfAbstractsDOCX';

export default function BookOfAbstractsManager({ conferences, userRole }) {
    const [selectedConfId, setSelectedConfId] = useState('');
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [deletedItemIds, setDeletedItemIds] = useState([]);
    const [showDeleted, setShowDeleted] = useState(false);

    const [fieldsConfig, setFieldsConfig] = useState({
        showAuthors: true,
        showContent: true,
        showTime: false,
        showKeywords: false
    });

    const selectedConf = conferences?.find(c => c.id.toString() === selectedConfId);

    useEffect(() => {
        const loadData = async (id) => {
            setIsLoading(true);
            try {
                const { items: fetchedItems, savedState } = await getAbstractsData(id);
                
                // Set default order (Orals first by time, then Posters by cluster/code)
                fetchedItems.sort((a, b) => {
                    const sortA = a.sortKey || '';
                    const sortB = b.sortKey || '';
                    if (sortA < sortB) return -1;
                    if (sortA > sortB) return 1;
                    return 0;
                });

                if (savedState) {
                    setDeletedItemIds(savedState.deletedItemIds || []);
                    if (savedState.sortedIds && savedState.sortedIds.length > 0) {
                        const sortedMap = new Map();
                        savedState.sortedIds.forEach((sid, index) => sortedMap.set(sid, index));
                        fetchedItems.sort((a, b) => {
                            const aIndex = sortedMap.has(a.id) ? sortedMap.get(a.id) : 999999;
                            const bIndex = sortedMap.has(b.id) ? sortedMap.get(b.id) : 999999;
                            return aIndex - bIndex;
                        });
                    }
                } else {
                    setDeletedItemIds([]);
                }
                
                setItems(fetchedItems);
            } catch (err) {
                console.error(err);
                alert("Failed to load data");
            } finally {
                setIsLoading(false);
            }
        };

        if (selectedConfId) {
            loadData(selectedConfId);
        } else {
            setItems([]);
            setDeletedItemIds([]);
        }
    }, [selectedConfId]);

    const handleSaveState = async (newItems, newDeletedIds) => {
        if (!selectedConfId) return;
        const sortedIds = newItems.map(i => i.id);
        const state = { sortedIds, deletedItemIds: newDeletedIds };
        try {
            await saveBookOfAbstractsState(selectedConfId, state);
        } catch(e) {
            console.error('Failed to save state', e);
        }
    };

    const moveItemUp = (index) => {
        if (index === 0) return;
        const newItems = [...items];
        const temp = newItems[index - 1];
        newItems[index - 1] = newItems[index];
        newItems[index] = temp;
        setItems(newItems);
        handleSaveState(newItems, deletedItemIds);
    };

    const moveItemDown = (index) => {
        if (index === items.length - 1) return;
        const newItems = [...items];
        const temp = newItems[index + 1];
        newItems[index + 1] = newItems[index];
        newItems[index] = temp;
        setItems(newItems);
        handleSaveState(newItems, deletedItemIds);
    };

    const toggleExclude = (id) => {
        let newDeletedIds;
        if (deletedItemIds.includes(id)) {
            newDeletedIds = deletedItemIds.filter(itemId => itemId !== id);
        } else {
            newDeletedIds = [...deletedItemIds, id];
        }
        setDeletedItemIds(newDeletedIds);
        handleSaveState(items, newDeletedIds);
    };

    const handlePrintPdf = () => {
        const activeItems = items.filter(i => !deletedItemIds.includes(i.id));
        if (!selectedConf || activeItems.length === 0) return;
        
        const printState = {
            conference: selectedConf,
            items: activeItems,
            fieldsConfig
        };
        sessionStorage.setItem('book_of_abstracts_print_data', JSON.stringify(printState));
        window.open('/book-of-abstracts/print', '_blank');
    };

    const handleDownload = async () => {
        const activeItems = items.filter(i => !deletedItemIds.includes(i.id));
        if (!selectedConf || activeItems.length === 0) return;
        setIsGenerating(true);
        try {
            const blob = await generateBookOfAbstractsDOCX({
                conferenceName: selectedConf.name,
                items: activeItems,
                fieldsConfig
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Book_of_Abstracts_${selectedConf.acronym || 'Conf'}_${new Date().toISOString().slice(0, 10)}.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Failed to generate DOCX file.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="w-64">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Select Conference</label>
                    <select
                        value={selectedConfId}
                        onChange={(e) => setSelectedConfId(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none"
                    >
                        <option value="">-- Select a conference --</option>
                        {conferences?.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-4 items-center bg-slate-50 p-2 rounded-lg border border-slate-200 h-10">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={fieldsConfig.showAuthors}
                            onChange={e => setFieldsConfig(prev => ({ ...prev, showAuthors: e.target.checked }))}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Authors
                    </label>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={fieldsConfig.showContent}
                            onChange={e => setFieldsConfig(prev => ({ ...prev, showContent: e.target.checked }))}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Abstract
                    </label>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={fieldsConfig.showTime}
                            onChange={e => setFieldsConfig(prev => ({ ...prev, showTime: e.target.checked }))}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Program Time
                    </label>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={fieldsConfig.showKeywords}
                            onChange={e => setFieldsConfig(prev => ({ ...prev, showKeywords: e.target.checked }))}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Keywords
                    </label>
                </div>

                <div className="ml-auto flex gap-2">
                    <button
                        onClick={handlePrintPdf}
                        disabled={!selectedConfId || isGenerating || items.filter(i => !deletedItemIds.includes(i.id)).length === 0}
                        className="flex items-center gap-2 h-10 px-4 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                    >
                        <Printer size={16} />
                        Download PDF
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={!selectedConfId || isGenerating || items.filter(i => !deletedItemIds.includes(i.id)).length === 0}
                        className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                    >
                        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                        {isGenerating ? 'Generating...' : 'Download DOCX'}
                    </button>
                </div>
            </div>

            {selectedConfId && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800">
                                {showDeleted ? 'Excluded Items' : 'Included Items'} ({items.filter(i => showDeleted ? deletedItemIds.includes(i.id) : !deletedItemIds.includes(i.id)).length})
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {showDeleted ? 'These items will NOT be in the generated document.' : 'Use arrows to reorder items. This order will be preserved in the document.'}
                            </p>
                        </div>
                        <button 
                            onClick={() => setShowDeleted(!showDeleted)}
                            className="text-xs font-medium px-3 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                        >
                            {showDeleted ? 'View Included' : `View Excluded (${deletedItemIds.length})`}
                        </button>
                    </div>
                    
                    <div className="p-0 overflow-y-auto max-h-[60vh]">
                        {isLoading ? (
                            <div className="p-8 flex justify-center text-slate-400">
                                <Loader2 className="animate-spin" />
                            </div>
                        ) : items.filter(i => showDeleted ? deletedItemIds.includes(i.id) : !deletedItemIds.includes(i.id)).length === 0 ? (
                            <div className="p-8 text-center text-sm text-slate-500">
                                {showDeleted ? 'No excluded items.' : 'No items found for this conference.'}
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {items.map((item, index) => {
                                    const isDeleted = deletedItemIds.includes(item.id);
                                    if ((showDeleted && !isDeleted) || (!showDeleted && isDeleted)) return null;
                                    
                                    return (
                                    <li key={item.id} className={`flex items-center gap-4 p-3 transition-colors group ${isDeleted ? 'bg-slate-50 opacity-75' : 'hover:bg-slate-50'}`}>
                                        <div className="flex flex-col gap-1 items-center px-2">
                                            <button 
                                                onClick={() => moveItemUp(index)} 
                                                disabled={index === 0 || isDeleted}
                                                className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:hover:text-slate-300"
                                            >
                                                <ArrowUp size={16} />
                                            </button>
                                            <button 
                                                onClick={() => moveItemDown(index)} 
                                                disabled={index === items.length - 1}
                                                className="text-slate-300 hover:text-slate-600 disabled:opacity-30 disabled:hover:text-slate-300"
                                            >
                                                <ArrowDown size={16} />
                                            </button>
                                        </div>
                                        
                                        <div className="w-[60px] shrink-0">
                                            <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                item.type === 'oral' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {item.type}
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className={`text-sm font-medium truncate ${isDeleted ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                                                {item.code && <span className="font-bold mr-1.5 text-slate-700">{item.code}</span>}
                                                {item.title || 'Untitled'}
                                            </h4>
                                            <div className="text-xs text-slate-500 truncate mt-0.5 flex gap-2">
                                                <span className="font-semibold text-slate-700">{item.groupInfo}</span>
                                                {item.authors && <span>• {typeof item.authors === 'string' && item.authors.startsWith('[') ? 'Multiple authors' : item.authors}</span>}
                                            </div>
                                        </div>

                                        <div className="px-2">
                                            {isDeleted ? (
                                                <button 
                                                    onClick={() => toggleExclude(item.id)}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition-colors"
                                                    title="Restore item"
                                                >
                                                    <Undo2 size={16} />
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => toggleExclude(item.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Exclude from book"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                )})}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
