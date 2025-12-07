import React, { useState, useMemo } from 'react';
import {
    Library,
    FileQuestion,
    Trash,
    Folder,
    FolderOpen,
    Plus,
    MoreVertical,
    ChevronRight,
    ChevronDown,
    Edit2,
    X,
    FolderPlus,
    Settings,
    Sun,
    Moon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, Collection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface SidebarProps {
    activeFilter: string;
    onFilterChange: (filter: string) => void;
    className?: string;
    onDropItem?: (itemId: string, collectionId: string) => void;
    onOpenSettings?: () => void;
}

export function Sidebar({ activeFilter, onFilterChange, className, onDropItem, onOpenSettings }: SidebarProps) {
    const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
    const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const { theme, setTheme } = useTheme();

    const collections = useLiveQuery(() => db.collections.toArray());
    const items = useLiveQuery(() => db.items.toArray());

    // Calculate item counts for each collection
    const itemCounts = useMemo(() => {
        const counts = new Map<string, number>();
        if (items) {
            items.forEach(item => {
                if (!item.deleted) {
                    item.collectionIds?.forEach(cid => {
                        counts.set(cid, (counts.get(cid) || 0) + 1);
                    });
                }
            });
        }
        return counts;
    }, [items]);

    // Build tree structure
    const collectionTree = useMemo(() => {
        if (!collections) return [];

        const tree: (Collection & { children: any[] })[] = [];
        const map = new Map();

        // First pass: create nodes
        collections.forEach(c => {
            map.set(c.id, { ...c, children: [] });
        });

        // Second pass: link parent/child
        collections.forEach(c => {
            if (c.parentId && map.has(c.parentId)) {
                map.get(c.parentId).children.push(map.get(c.id));
            } else {
                tree.push(map.get(c.id));
            }
        });

        return tree;
    }, [collections]);

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedCollections);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedCollections(newExpanded);
    };

    const handleCreateCollection = async (parentId: string | null = null) => {
        const name = prompt('Enter collection name:');
        if (!name) return;

        const newId = uuidv4();
        await db.collections.add({
            id: newId,
            name,
            parentId,
            dateAdded: Date.now()
        });

        // Auto expand parent
        if (parentId) {
            const newExpanded = new Set(expandedCollections);
            newExpanded.add(parentId);
            setExpandedCollections(newExpanded);
        }
    };

    const handleRenameCollection = async (id: string, newName: string) => {
        if (!newName.trim()) return;
        await db.collections.update(id, { name: newName });
        setEditingCollectionId(null);
    };

    const handleDeleteCollection = async (id: string) => {
        if (confirm('Delete this collection? Items within it will not be deleted.')) {
            const deleteRecursive = async (targetId: string) => {
                const children = await db.collections.where('parentId').equals(targetId).toArray();
                for (const child of children) {
                    await deleteRecursive(child.id);
                }
                await db.collections.delete(targetId);

                // Also remove from items
                const items = await db.items.where('collectionIds').equals(targetId).toArray();
                for (const item of items) {
                    if (item.collectionIds) {
                        const newIds = item.collectionIds.filter(cid => cid !== targetId);
                        await db.items.update(item.id, { collectionIds: newIds });
                    }
                }
            };

            await deleteRecursive(id);
            if (activeFilter === id) onFilterChange('all');
        }
    };

    const handleDrop = async (e: React.DragEvent, targetCollectionId: string) => {
        e.preventDefault();
        e.stopPropagation();

        const itemsJson = e.dataTransfer.getData('application/antigra-items');
        const singleItemId = e.dataTransfer.getData('application/antigra-item');

        let itemIds: string[] = [];

        if (itemsJson) {
            try {
                itemIds = JSON.parse(itemsJson);
            } catch (e) {
                console.error('Failed to parse dragged items', e);
            }
        } else if (singleItemId) {
            itemIds = [singleItemId];
        }

        if (itemIds.length > 0) {
            await db.transaction('rw', db.items, async () => {
                for (const itemId of itemIds) {
                    const item = await db.items.get(itemId);
                    if (item) {
                        const currentCollections = item.collectionIds || [];
                        if (!currentCollections.includes(targetCollectionId)) {
                            await db.items.update(itemId, {
                                collectionIds: [...currentCollections, targetCollectionId]
                            });
                        }
                    }
                }
            });
        }
    };

    const CollectionItem = ({ node, depth = 0 }: { node: any, depth?: number }) => {
        const isExpanded = expandedCollections.has(node.id);
        const isActive = activeFilter === node.id;
        const isEditing = editingCollectionId === node.id;
        const isDragOver = dragOverId === node.id;
        const count = itemCounts.get(node.id) || 0;

        return (
            <div className="select-none">
                <div
                    className={cn(
                        "flex items-center group px-2 py-1.5 cursor-pointer transition-all text-sm rounded-lg mx-2 mb-0.5 relative",
                        isActive
                            ? "bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-200 shadow-sm"
                            : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200",
                        isDragOver && "bg-blue-500/20 text-blue-300 ring-2 ring-blue-500/50 z-10"
                    )}
                    style={{ paddingLeft: `${depth * 16 + 8}px` }}
                    onClick={() => onFilterChange(node.id)}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.types.includes('application/antigra-item') ||
                            e.dataTransfer.types.includes('application/antigra-items')) {
                            setDragOverId(node.id);
                        }
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragOverId === node.id) {
                            setDragOverId(null);
                        }
                    }}
                    onDrop={(e) => {
                        setDragOverId(null);
                        handleDrop(e, node.id);
                    }}
                >
                    <button
                        className={cn(
                            "p-0.5 mr-1 rounded hover:bg-white/10 transition-colors",
                            node.children.length === 0 && "invisible"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(node.id);
                        }}
                    >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>

                    {isExpanded ? (
                        <FolderOpen className={cn("w-4 h-4 mr-2", isActive ? "text-blue-600 dark:text-blue-200" : "text-blue-400")} />
                    ) : (
                        <Folder className={cn("w-4 h-4 mr-2", isActive ? "text-blue-600 dark:text-blue-200" : "text-blue-400")} />
                    )}

                    {isEditing ? (
                        <input
                            autoFocus
                            className="bg-zinc-950 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => handleRenameCollection(node.id, editName)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameCollection(node.id, editName);
                                if (e.key === 'Escape') setEditingCollectionId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span className="flex-1 truncate font-medium">{node.name}</span>
                    )}

                    {count > 0 && !isEditing && (
                        <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full ml-2",
                            isActive ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-300"
                        )}>
                            {count}
                        </span>
                    )}

                    <div className={cn(
                        "flex items-center ml-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 bg-white dark:bg-zinc-800 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-700",
                        isActive && "border-blue-400 dark:border-blue-400"
                    )}>
                        <button
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-l-md text-zinc-500 dark:text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCreateCollection(node.id);
                            }}
                            title="New Subcollection"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                        <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-700"></div>
                        <button
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditName(node.name);
                                setEditingCollectionId(node.id);
                            }}
                            title="Rename"
                        >
                            <Edit2 className="w-3 h-3" />
                        </button>
                        <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-700"></div>
                        <button
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-r-md text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCollection(node.id);
                            }}
                            title="Delete"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {isExpanded && node.children.map((child: any) => (
                    <CollectionItem key={child.id} node={child} depth={depth + 1} />
                ))}
            </div>
        );
    };

    return (
        <div className={cn("w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full select-none", className)}>
            <div className="p-5 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
                    <Library className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Antigra
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                <div className="mb-8">
                    <div className="px-5 text-[10px] font-bold text-zinc-500 mb-3 uppercase tracking-widest">
                        Library
                    </div>
                    <nav className="space-y-1 px-3">
                        <button
                            onClick={() => onFilterChange('all')}
                            className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors border",
                                activeFilter === 'all'
                                    ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20 font-medium"
                                    : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/60"
                            )}
                        >
                            <div className="flex items-center">
                                <Library className="w-4 h-4 mr-3 text-blue-600 dark:text-blue-400" />
                                My Library
                            </div>
                            {items && (
                                <span className="text-xs text-zinc-600 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">
                                    {items.filter(i => !i.deleted).length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => onFilterChange('unfiled')}
                            className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors border",
                                activeFilter === 'unfiled'
                                    ? "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/20 font-medium"
                                    : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/60"
                            )}
                        >
                            <div className="flex items-center">
                                <FileQuestion className="w-4 h-4 mr-3 text-orange-600 dark:text-orange-400" />
                                Unfiled Items
                            </div>
                            {items && (
                                <span className="text-xs text-zinc-600 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">
                                    {items.filter(i => !i.deleted && (!i.collectionIds || i.collectionIds.length === 0)).length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => onFilterChange('trash')}
                            className={cn("w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors border",
                                activeFilter === 'trash'
                                    ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20 font-medium"
                                    : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/60"
                            )}
                        >
                            <div className="flex items-center">
                                <Trash className="w-4 h-4 mr-3 text-red-600 dark:text-red-400" />
                                Trash
                            </div>
                            {items && (
                                <span className="text-xs text-zinc-600 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">
                                    {items.filter(i => !!i.deleted).length}
                                </span>
                            )}
                        </button>
                    </nav>
                </div>

                <div>
                    <div className="px-5 flex items-center justify-between mb-3 group">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            Collections
                        </span>
                        <button
                            onClick={() => handleCreateCollection(null)}
                            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                            title="New Collection"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-0.5 px-1">
                        {collectionTree.map(node => (
                            <CollectionItem key={node.id} node={node} />
                        ))}
                        {collectionTree.length === 0 && (
                            <div className="px-6 py-8 flex flex-col items-center justify-center text-zinc-600 gap-2 border-2 border-dashed border-zinc-300 dark:border-zinc-900 rounded-xl mx-4 bg-zinc-50 dark:bg-zinc-900/30">
                                <FolderPlus className="w-8 h-8 opacity-50" />
                                <span className="text-xs font-medium">No collections</span>
                                <button
                                    onClick={() => handleCreateCollection(null)}
                                    className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline"
                                >
                                    Create one
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onOpenSettings}
                        className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 rounded-md transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        Settings
                    </button>
                    <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 rounded-md transition-colors"
                        title="Toggle Theme"
                    >
                        <Sun className="hidden dark:block w-4 h-4" />
                        <Moon className="block dark:hidden w-4 h-4" />
                    </button>
                </div>

                <div className="px-3 pt-2 text-[10px] text-zinc-500 font-mono flex justify-between items-center opacity-60">
                    <span>v0.1.0-beta</span>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" title="Online"></div>
                </div>
            </div>
        </div>
    );
}
