import React from 'react';
import { ReferenceItem } from '@/lib/db';
import { FileText, ChevronUp, ChevronDown, BookOpen, GraduationCap, File, Plus } from 'lucide-react';
import { cn, cleanTitle } from '@/lib/utils';
import { ColumnSelector, ColumnConfig } from './ColumnSelector';

export type SortField = 'title' | 'creator' | 'date' | 'publicationTitle' | 'dateAdded';
export type SortDirection = 'asc' | 'desc';

interface ReferenceListProps {
    items: ReferenceItem[];
    selectedIds: Set<string>;
    onSelect: (ids: Set<string>) => void;
    sortField: SortField;
    sortDirection: SortDirection;
    onSort: (field: SortField) => void;
    columns: ColumnConfig[];
    onColumnsChange: (columns: ColumnConfig[]) => void;
    onImport?: () => void;
}

export function ReferenceList({
    items,
    selectedIds,
    onSelect,
    sortField,
    sortDirection,
    onSort,
    columns,
    onColumnsChange,
    onImport
}: ReferenceListProps) {
    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
    };

    const HeaderCell = ({ field, label, className }: { field: SortField, label: string, className?: string }) => {
        const column = columns.find(c => c.id === field);
        if (!column?.visible) return null;

        return (
            <th
                className={cn("py-3 px-4 text-xs font-semibold text-zinc-700 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors select-none bg-white dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10", className)}
                onClick={() => onSort(field)}
            >
                <div className="flex items-center gap-1">
                    {label}
                    <SortIcon field={field} />
                </div>
            </th>
        );
    };
    // ... (rest of helper functions like handleRowClick)

    const handleRowClick = (e: React.MouseEvent, id: string) => {
        e.preventDefault();

        let newSelection = new Set(selectedIds);

        if (e.metaKey || e.ctrlKey) {
            // Toggle selection
            if (newSelection.has(id)) {
                newSelection.delete(id);
            } else {
                newSelection.add(id);
            }
        } else if (e.shiftKey && selectedIds.size > 0) {
            // Range selection
            const lastSelectedId = Array.from(selectedIds).pop();
            const lastIndex = items.findIndex(item => item.id === lastSelectedId);
            const currentIndex = items.findIndex(item => item.id === id);

            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);

                // Add all items in range
                for (let i = start; i <= end; i++) {
                    newSelection.add(items[i].id);
                }
            } else {
                newSelection = new Set([id]);
            }
        } else {
            // Single selection
            newSelection = new Set([id]);
        }

        onSelect(newSelection);
    };

    const getItemIcon = (type: string) => {
        switch (type) {
            case 'journalArticle':
                return <FileText className="w-4 h-4 text-blue-400" />;
            case 'book':
                return <BookOpen className="w-4 h-4 text-green-400" />;
            case 'thesis':
                return <GraduationCap className="w-4 h-4 text-purple-400" />;
            default:
                return <File className="w-4 h-4 text-zinc-500" />;
        }
    };

    if (items.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 bg-white dark:bg-zinc-950">
                <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-200 dark:border-zinc-800">
                    <FileText className="w-10 h-10 text-zinc-400 dark:text-zinc-600" />
                </div>
                <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-300 mb-2">No items found</h3>
                <p className="text-sm text-zinc-500 max-w-xs text-center mb-6">
                    Drag and drop PDF files here to add them to your library, or create a new item manually.
                </p>

                {onImport && (
                    <button
                        onClick={onImport}
                        className="flex items-center gap-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 px-4 py-2 rounded-md font-medium transition-all shadow-sm active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Import PDFs
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 relative">
            {/* Column Selector */}
            <div className="absolute right-4 top-3 z-20">
                <ColumnSelector columns={columns} onColumnsChange={onColumnsChange} />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar" onClick={() => {
                // Optional: Clear selection when clicking empty space?
                // onSelect(new Set());
            }}>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="py-3 px-4 text-xs font-medium text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 w-10 bg-white dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10"></th>
                            <HeaderCell field="title" label="Title" />
                            <HeaderCell field="creator" label="Creator" className="w-48" />
                            <HeaderCell field="date" label="Year" className="w-24" />
                            <HeaderCell field="publicationTitle" label="Publication" className="w-48" />
                            <HeaderCell field="dateAdded" label="Date Added" className="w-40" />
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => {
                            const isSelected = selectedIds.has(item.id);
                            return (
                                <tr
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => {
                                        const idsToDrag = isSelected
                                            ? Array.from(selectedIds)
                                            : [item.id];
                                        e.dataTransfer.setData('application/antigra-items', JSON.stringify(idsToDrag));
                                        e.dataTransfer.effectAllowed = 'copy';

                                        // Visual feedback
                                        const dragPreview = document.createElement('div');
                                        dragPreview.innerText = `${idsToDrag.length} items`;
                                        dragPreview.style.background = '#3b82f6';
                                        dragPreview.style.color = 'white';
                                        dragPreview.style.padding = '4px 8px';
                                        dragPreview.style.borderRadius = '4px';
                                        dragPreview.style.position = 'absolute';
                                        dragPreview.style.top = '-1000px';
                                        document.body.appendChild(dragPreview);
                                        e.dataTransfer.setDragImage(dragPreview, 0, 0);
                                        setTimeout(() => document.body.removeChild(dragPreview), 0);
                                    }}
                                    onClick={(e) => handleRowClick(e, item.id)}
                                    className={cn(
                                        "group cursor-pointer transition-all border-b border-zinc-100 dark:border-zinc-800/40 select-none",
                                        isSelected
                                            ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                                            : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                                    )}
                                >
                                    <td className="py-3 px-4">
                                        <div className={cn(
                                            "transition-transform duration-200 group-hover:scale-110",
                                            isSelected ? "scale-110" : ""
                                        )}>
                                            {getItemIcon(item.type)}
                                        </div>
                                    </td>
                                    {columns.find(c => c.id === 'title')?.visible && (
                                        <td className="py-3 px-4">
                                            <div className={cn(
                                                "text-sm font-medium truncate max-w-[400px] transition-colors",
                                                isSelected ? "text-blue-900 dark:text-blue-100" : "text-zinc-900 dark:text-zinc-200 group-hover:text-black dark:group-hover:text-white"
                                            )}>
                                                {cleanTitle(item.title)}
                                            </div>
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'creator')?.visible && (
                                        <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400 truncate max-w-[200px]">
                                            {item.creators && item.creators.length > 0
                                                ? <span className={isSelected ? "text-blue-700 dark:text-blue-200/70" : ""}>
                                                    {item.creators[0].lastName}{item.creators.length > 1 && <span className="text-zinc-500 dark:text-zinc-600 italic ml-1">et al.</span>}
                                                </span>
                                                : <span className="text-zinc-400 dark:text-zinc-700 italic">Unknown</span>}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'date')?.visible && (
                                        <td className="py-3 px-4 text-sm text-zinc-500 dark:text-zinc-500 font-mono">
                                            {item.date ? new Date(item.date).getFullYear() : '-'}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'publicationTitle')?.visible && (
                                        <td className="py-3 px-4 text-sm text-zinc-500 truncate max-w-[200px] italic">
                                            {item.publicationTitle || '-'}
                                        </td>
                                    )}
                                    {columns.find(c => c.id === 'dateAdded')?.visible && (
                                        <td className="py-3 px-4 text-sm text-zinc-500 dark:text-zinc-600 font-mono text-xs">
                                            {new Date(item.dateAdded).toLocaleDateString()}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
