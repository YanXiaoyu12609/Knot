import React, { useState } from 'react';
import { Settings2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ColumnConfig {
    id: string;
    label: string;
    visible: boolean;
    fixed?: boolean; // 固定列不可隐藏
}

interface ColumnSelectorProps {
    columns: ColumnConfig[];
    onColumnsChange: (columns: ColumnConfig[]) => void;
}

export function ColumnSelector({ columns, onColumnsChange }: ColumnSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleColumn = (columnId: string) => {
        const newColumns = columns.map(col =>
            col.id === columnId && !col.fixed
                ? { ...col, visible: !col.visible }
                : col
        );
        onColumnsChange(newColumns);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                title="自定义列"
            >
                <Settings2 className="w-4 h-4" />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 py-2">
                        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-700">
                            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">显示列</p>
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {columns.map(column => (
                                <button
                                    key={column.id}
                                    onClick={() => toggleColumn(column.id)}
                                    disabled={column.fixed}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2 text-sm transition-colors",
                                        column.fixed
                                            ? "text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                                            : "text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                    )}
                                >
                                    <span>{column.label}</span>
                                    {column.visible && (
                                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
