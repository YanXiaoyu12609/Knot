'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ReferenceList, SortField, SortDirection } from '@/components/ReferenceList';
import { DetailPanel } from '@/components/DetailPanel';
import { AnalysisPanel } from '@/components/AnalysisPanel';
import { ColumnConfig } from '@/components/ColumnSelector';
import { GraphView } from '@/components/GraphView';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ReferenceItem, Attachment } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Plus, X, Network, RefreshCcw, Trash, FolderMinus, FileDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import { SettingsModal } from '@/components/SettingsModal';

const PdfViewer = dynamic(() => import('@/components/PdfViewer').then(mod => ({ default: mod.PdfViewer })), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center text-white">Loading PDF viewer...</div>
});

export default function Home() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('dateAdded');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'title', label: '标题', visible: true, fixed: true },
    { id: 'creator', label: '创建者', visible: true },
    { id: 'date', label: '年份', visible: true },
    { id: 'publicationTitle', label: '出版物', visible: true },
    { id: 'dateAdded', label: '添加时间', visible: false },
  ]);

  const items = useLiveQuery(
    async () => {
      // 1. Filter by collection/trash
      let collection = db.items.toCollection();

      if (activeFilter === 'trash') {
        collection = db.items.filter(item => !!item.deleted);
      } else if (activeFilter === 'unfiled') {
        collection = db.items.filter(item => !item.deleted && (!item.collectionIds || item.collectionIds.length === 0));
      } else if (activeFilter === 'all') {
        collection = db.items.filter(item => !item.deleted);
      } else {
        // It's a specific collection ID
        collection = db.items.filter(item => !item.deleted && !!item.collectionIds?.includes(activeFilter));
      }

      // 2. Apply Search
      if (searchQuery) {
        const parts = searchQuery.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const filters: Record<string, string[]> = { general: [] };

        parts.forEach(part => {
          const match = part.match(/^([a-zA-Z]+):(.+)$/);
          if (match) {
            const key = match[1].toLowerCase();
            const value = match[2].replace(/"/g, '').toLowerCase();
            if (!filters[key]) filters[key] = [];
            filters[key].push(value);
          } else {
            filters.general.push(part.replace(/"/g, '').toLowerCase());
          }
        });

        collection = collection.and(item => {
          // 1. Check Author/Creator
          if (filters.author || filters.creator) {
            const queries = [...(filters.author || []), ...(filters.creator || [])];
            const match = queries.every(q =>
              item.creators?.some(c =>
                c.lastName.toLowerCase().includes(q) ||
                c.firstName?.toLowerCase().includes(q)
              )
            );
            if (!match) return false;
          }

          // 2. Check Year/Date
          if (filters.year || filters.date) {
            const queries = [...(filters.year || []), ...(filters.date || [])];
            const match = queries.every(q => item.date?.includes(q));
            if (!match) return false;
          }

          // 3. Check Title
          if (filters.title) {
            const match = filters.title.every(q => item.title?.toLowerCase().includes(q));
            if (!match) return false;
          }

          // 4. Check Publication/Source
          if (filters.publication || filters.source) {
            const queries = [...(filters.publication || []), ...(filters.source || [])];
            const match = queries.every(q => item.publicationTitle?.toLowerCase().includes(q));
            if (!match) return false;
          }

          // 5. General Keywords (check all fields)
          if (filters.general.length > 0) {
            const match = filters.general.every(q =>
              item.title?.toLowerCase().includes(q) ||
              item.creators?.some(c => c.lastName.toLowerCase().includes(q) || c.firstName?.toLowerCase().includes(q)) ||
              item.publicationTitle?.toLowerCase().includes(q) ||
              item.abstract?.toLowerCase().includes(q) ||
              item.doi?.toLowerCase().includes(q)
            );
            if (!match) return false;
          }
          return true;
        });
      }

      // 3. Sort
      let resultArray = await collection.toArray();

      resultArray.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        switch (sortField) {
          case 'title':
            valA = a.title?.toLowerCase() || '';
            valB = b.title?.toLowerCase() || '';
            break;
          case 'creator':
            valA = a.creators?.[0]?.lastName?.toLowerCase() || '';
            valB = b.creators?.[0]?.lastName?.toLowerCase() || '';
            break;
          case 'date':
            valA = a.date || '';
            valB = b.date || '';
            break;
          case 'publicationTitle':
            valA = a.publicationTitle?.toLowerCase() || '';
            valB = b.publicationTitle?.toLowerCase() || '';
            break;
          case 'dateAdded':
          default:
            valA = a.dateAdded;
            valB = b.dateAdded;
            break;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });

      return resultArray;
    },
    [activeFilter, searchQuery, sortField, sortDirection]
  );

  // Keyboard shortcut: Space to toggle PDF preview
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Only trigger if Space is pressed
      if (e.code === 'Space' && selectedIds.size > 0) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        e.preventDefault();

        // If already previewing, close it
        if (pdfPreviewUrl) {
          URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl(null);
          return;
        }

        // Otherwise, open preview
        // Use the most recently selected item (or just the first one)
        const firstId = Array.from(selectedIds)[0];
        const attachments = await db.attachments.where('parentId').equals(firstId).toArray();
        const pdfAttachment = attachments.find(a => a.contentType === 'application/pdf');

        if (pdfAttachment && pdfAttachment.data) {
          const url = URL.createObjectURL(pdfAttachment.data as Blob);
          setPdfPreviewUrl(url);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, pdfPreviewUrl]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAddItem = async () => {
    const newItem: ReferenceItem = {
      id: uuidv4(),
      type: 'journalArticle',
      title: 'New Reference',
      creators: [],
      tags: [],
      dateAdded: Date.now(),
      dateModified: Date.now()
    };
    const id = await db.items.add(newItem) as string;
    setSelectedIds(new Set([id]));
  };

  // Global drag and drop for PDF files
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only show overlay if dragging files, not internal items
    if (e.dataTransfer.types.includes('Files') &&
      !e.dataTransfer.types.includes('application/antigra-item') &&
      !e.dataTransfer.types.includes('application/antigra-items')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide if leaving the main container
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleImportFiles = async (files: File[]) => {
    const pdfFiles = files.filter(f => f.type === 'application/pdf');

    if (pdfFiles.length === 0) return;

    const newIds = new Set<string>();

    for (const file of pdfFiles) {
      // 1. Create new item
      const newItem: ReferenceItem = {
        id: uuidv4(),
        type: 'journalArticle',
        title: file.name.replace('.pdf', ''),
        creators: [],
        tags: [],
        dateAdded: Date.now(),
        dateModified: Date.now()
      };

      // If we are in a specific collection, add the item to it
      if (activeFilter !== 'all' && activeFilter !== 'trash' && activeFilter !== 'unfiled') {
        newItem.collectionIds = [activeFilter];
      }

      const itemId = await db.items.add(newItem) as string;
      newIds.add(itemId);

      // 2. Add PDF as attachment
      const attachment: Attachment = {
        id: uuidv4(),
        parentId: itemId,
        name: file.name,
        contentType: file.type,
        size: file.size,
        data: file, // Store as Blob/File
        dateAdded: Date.now()
      };
      await db.attachments.add(attachment);

      // 3. Try to extract metadata
      let metadataExtracted = false;
      try {
        const { extractMetadataFromPdf } = await import('@/lib/metadata');
        const metadata = await extractMetadataFromPdf(file);
        if (metadata) {
          metadataExtracted = true;
          const updates: Partial<ReferenceItem> = {
            dateModified: Date.now()
          };
          if (metadata.title) updates.title = metadata.title;
          if (metadata.creators) updates.creators = metadata.creators;
          if (metadata.date) updates.date = metadata.date;
          if (metadata.publicationTitle) updates.publicationTitle = metadata.publicationTitle;
          if (metadata.doi) updates.doi = metadata.doi;
          if (metadata.abstract) updates.abstract = metadata.abstract;
          if (metadata.type) updates.type = metadata.type;

          await db.items.update(itemId, updates);
        }
      } catch (error) {
        console.error('Failed to extract metadata:', error);
      }

      // 4. Auto-analyze with Gemini if key exists
      const apiKey = localStorage.getItem('gemini_api_key');
      if (apiKey) {
        const modelName = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';

        // Start tracking analysis globally
        const startTime = Date.now();
        const { activeAnalyses, saveAnalysisDuration } = await import('@/lib/analysisState');
        activeAnalyses.set(itemId, startTime);

        // Run in background
        import('@/lib/gemini').then(async ({ analyzePdfWithGemini }) => {
          try {
            const analysis = await analyzePdfWithGemini(apiKey, file, modelName);

            // Basic update
            const updates: Partial<ReferenceItem> = {
              aiAnalysis: analysis,
              dateModified: Date.now()
            };

            // If metadata was NOT extracted from PDF, try to fill it from AI analysis
            if (!metadataExtracted) {
              const matter = (await import('gray-matter')).default;
              const { data } = matter(analysis);

              if (data.title) updates.title = data.title;
              if (data.publication) updates.publicationTitle = data.publication;
              if (data.year) updates.date = String(data.year);
              if (data.doi) updates.doi = data.doi;
              if (data.url) updates.url = data.url;

              // Parse authors
              if (data.authors && Array.isArray(data.authors)) {
                updates.creators = data.authors.map((auth: string) => {
                  const name = auth.replace(/^\[\[(.*?)\]\]$/, '$1').trim();
                  const parts = name.split(' ');
                  const lastName = parts.pop() || '';
                  const firstName = parts.join(' ');
                  return { firstName, lastName, creatorType: 'author' };
                });
              }

              // Always sync tags
              if (data.tags && Array.isArray(data.tags)) {
                updates.tags = data.tags;
              }
            } else {
              // Even if metadata WAS extracted, we might want to merge tags
              const matter = (await import('gray-matter')).default;
              const { data } = matter(analysis);
              if (data.tags && Array.isArray(data.tags)) {
                updates.tags = data.tags;
              }
            }

            await db.items.update(itemId, updates);
            saveAnalysisDuration(Date.now() - startTime);

          } catch (err) {
            console.error('Auto-analysis failed:', err);
          } finally {
            activeAnalyses.delete(itemId);
          }
        });
      }
    }

    setSelectedIds(newIds);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    await handleImportFiles(files);
  };

  return (
    <div
      className="flex h-screen w-full bg-zinc-100 dark:bg-black text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Sidebar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        className="flex-shrink-0"
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950">
        {/* Toolbar */}
        <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-6 justify-between bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl gap-6 z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddItem}
                className="flex items-center gap-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-md text-sm font-medium transition-all shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                New Item
              </button>
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="application/pdf"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    handleImportFiles(Array.from(e.target.files));
                    e.target.value = ''; // Reset
                  }
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all active:scale-95"
                title="Import PDF files"
              >
                <FileDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowGraph(true)}
                className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all active:scale-95"
                title="Open Graph View"
              >
                <Network className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search library..."
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-zinc-900 dark:text-zinc-200 placeholder-zinc-500 dark:placeholder-zinc-600 focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1 rounded-full hover:bg-zinc-700/50 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5 pointer-events-none hidden group-hover:block group-focus-within:hidden">
              ⌘K
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-4 w-px bg-zinc-800"></div>
            <div className="text-xs font-medium text-zinc-500">
              {items ? (
                <span>{items.length} items</span>
              ) : (
                <span className="animate-pulse">Loading...</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <ReferenceList
            items={items || []}
            selectedIds={selectedIds}
            onSelect={setSelectedIds}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={(field) => {
              if (sortField === field) {
                setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
              } else {
                setSortField(field);
                setSortDirection('asc');
              }
            }}
            columns={columns}
            onColumnsChange={setColumns}
            onImport={() => fileInputRef.current?.click()}
          />

          {/* Detail Panel */}
          {selectedIds.size === 1 && (
            <DetailPanel
              itemId={Array.from(selectedIds)[0]}
              onClose={() => setSelectedIds(new Set())}
              activeCollectionId={['all', 'unfiled', 'trash'].includes(activeFilter) ? undefined : activeFilter}
              onOpenAnalysis={() => setShowAnalysisPanel(true)}
            />
          )}

          {/* Analysis Panel */}
          <AnalysisPanel
            itemId={selectedIds.size === 1 ? Array.from(selectedIds)[0] : null}
            isOpen={showAnalysisPanel}
            onClose={() => setShowAnalysisPanel(false)}
          />

          {/* Multi-select Panel */}
          {selectedIds.size > 1 && (
            <div className="w-96 border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6 flex flex-col items-center justify-center text-zinc-500">

              <div className="w-full max-w-[280px] space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 mb-3">
                    <span className="text-xl font-semibold text-zinc-700 dark:text-zinc-200">{selectedIds.size}</span>
                  </div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">items selected</p>
                </div>

                <div className="space-y-2">
                  {activeFilter !== 'trash' && !['all', 'unfiled'].includes(activeFilter) && (
                    <button
                      onClick={async () => {
                        if (confirm(`Remove ${selectedIds.size} items from this collection?`)) {
                          await db.transaction('rw', db.items, async () => {
                            const ids = Array.from(selectedIds);
                            for (const id of ids) {
                              const item = await db.items.get(id);
                              if (item && item.collectionIds) {
                                const newIds = item.collectionIds.filter(cid => cid !== activeFilter);
                                await db.items.update(id, { collectionIds: newIds });
                              }
                            }
                          });
                          setSelectedIds(new Set());
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 rounded-lg transition-all text-sm group"
                    >
                      <FolderMinus className="w-4 h-4 text-zinc-500 group-hover:text-orange-400 transition-colors" />
                      Remove from Collection
                    </button>
                  )}

                  {activeFilter !== 'trash' && (
                    <button
                      onClick={async () => {
                        if (confirm(`Move ${selectedIds.size} items to trash?`)) {
                          await db.transaction('rw', db.items, async () => {
                            await Promise.all(
                              Array.from(selectedIds).map(id =>
                                db.items.update(id, { deleted: true })
                              )
                            );
                          });
                          setSelectedIds(new Set());
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 rounded-lg transition-all text-sm group"
                    >
                      <Trash className="w-4 h-4 text-zinc-500 group-hover:text-red-400 transition-colors" />
                      Move to Trash
                    </button>
                  )}

                  {activeFilter === 'trash' && (
                    <>
                      <button
                        onClick={async () => {
                          if (confirm(`Restore ${selectedIds.size} items?`)) {
                            await db.transaction('rw', db.items, async () => {
                              await Promise.all(
                                Array.from(selectedIds).map(id =>
                                  db.items.update(id, { deleted: false })
                                )
                              );
                            });
                            setSelectedIds(new Set());
                          }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg transition-all text-sm group border border-zinc-200 dark:border-transparent"
                      >
                        <RefreshCcw className="w-4 h-4 text-zinc-500 group-hover:text-green-400 transition-colors" />
                        Restore Selected
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm(`Permanently delete ${selectedIds.size} items? This cannot be undone.`)) {
                            await db.transaction('rw', db.items, db.attachments, async () => {
                              const ids = Array.from(selectedIds);
                              await db.attachments.where('parentId').anyOf(ids).delete();
                              await db.items.bulkDelete(ids);
                            });
                            setSelectedIds(new Set());
                          }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 bg-red-900/10 hover:bg-red-900/20 text-red-400 border border-red-900/20 rounded-lg transition-all text-sm"
                      >
                        <Trash className="w-4 h-4" />
                        Delete Permanently
                      </button>
                    </>
                  )}
                </div>

                {activeFilter !== 'trash' && (
                  <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800/50">
                    <p className="text-xs font-medium text-zinc-500 uppercase mb-3 text-center tracking-wider">Export As</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={async () => {
                          const { generateBibliography } = await import('@/lib/export');
                          const selectedItems = await db.items.bulkGet(Array.from(selectedIds));
                          const bib = generateBibliography(selectedItems.filter(i => !!i) as ReferenceItem[], 'bibtex');
                          await navigator.clipboard.writeText(bib);
                          // Optional: Add toast notification here
                        }}
                        className="flex flex-col items-center justify-center gap-2 bg-white dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 py-3 rounded-lg transition-all active:scale-95 border border-zinc-200 dark:border-transparent"
                      >
                        <span className="font-mono text-xs opacity-70">.bib</span>
                        <span className="text-xs">BibTeX</span>
                      </button>
                      <button
                        onClick={async () => {
                          const { generateBibliography } = await import('@/lib/export');
                          const selectedItems = await db.items.bulkGet(Array.from(selectedIds));
                          const json = generateBibliography(selectedItems.filter(i => !!i) as ReferenceItem[], 'json');
                          await navigator.clipboard.writeText(JSON.stringify(JSON.parse(json), null, 2));
                        }}
                        className="flex flex-col items-center justify-center gap-2 bg-white dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 py-3 rounded-lg transition-all active:scale-95 border border-zinc-200 dark:border-transparent"
                      >
                        <span className="font-mono text-xs opacity-70">{ }</span>
                        <span className="text-xs">JSON</span>
                      </button>
                      <button
                        onClick={async () => {
                          const { generateBibliography } = await import('@/lib/export');
                          const selectedItems = await db.items.bulkGet(Array.from(selectedIds));
                          const text = generateBibliography(selectedItems.filter(i => !!i) as ReferenceItem[], 'text');
                          await navigator.clipboard.writeText(text);
                        }}
                        className="col-span-2 flex items-center justify-center gap-2 bg-white dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 py-3 rounded-lg transition-all active:scale-95 border border-zinc-200 dark:border-transparent"
                      >
                        <span className="text-xs">Copy Citation Text</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer Overlay */}
      {pdfPreviewUrl && (
        <PdfViewer
          fileUrl={pdfPreviewUrl}
          onClose={() => {
            URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl(null);
          }}
        />
      )}

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/10 border-4 border-blue-500 border-dashed z-[100] flex items-center justify-center backdrop-blur-sm pointer-events-none">
          <div className="bg-zinc-900/90 px-8 py-6 rounded-lg border-2 border-blue-500 shadow-2xl">
            <div className="text-blue-400 font-medium text-lg flex flex-col items-center gap-3">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-xl">拖放 PDF 文件以创建新条目</p>
              <p className="text-sm text-zinc-400">自动提取元数据</p>
            </div>
          </div>
        </div>
      )}

      {/* Graph View */}
      {showGraph && (
        <GraphView
          items={items || []}
          onSelectItem={(id) => {
            setSelectedIds(new Set([id]));
            setShowGraph(false);
          }}
          onClose={() => setShowGraph(false)}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
