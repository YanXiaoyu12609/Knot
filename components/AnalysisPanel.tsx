import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, RefreshCcw, Maximize2, Minimize2, Move, FileDown, FileText } from 'lucide-react';
import { ReferenceItem, db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MarkdownRenderer } from './MarkdownRenderer';
import { activeAnalyses, getEstimatedDuration, saveAnalysisDuration } from '@/lib/analysisState';
import matter from 'gray-matter';
import { cn } from '@/lib/utils';

interface AnalysisPanelProps {
    itemId: string | null;
    onClose: () => void;
    isOpen: boolean;
}

export function AnalysisPanel({ itemId, onClose, isOpen }: AnalysisPanelProps) {
    const item = useLiveQuery(
        () => (itemId ? db.items.get(itemId) : undefined),
        [itemId]
    );

    const attachments = useLiveQuery(
        () => (itemId ? db.attachments.where('parentId').equals(itemId).toArray() : []),
        [itemId]
    );

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);

    // Track current itemId for async operations
    const activeItemIdRef = useRef(itemId);
    useEffect(() => {
        activeItemIdRef.current = itemId;
    }, [itemId]);

    // Monitor analysis status
    useEffect(() => {
        const isGloballyAnalyzing = itemId && activeAnalyses.has(itemId);

        if (isGloballyAnalyzing) {
            if (!isAnalyzing) {
                setIsAnalyzing(true);
                setAnalysisError(null);

                const startTime = activeAnalyses.get(itemId!)!;
                const elapsed = Date.now() - startTime;
                const estimatedDuration = getEstimatedDuration();
                const estimatedProgress = Math.min(95, (elapsed / estimatedDuration) * 100);
                setProgress(estimatedProgress);
            }
        } else {
            if (isAnalyzing) {
                setIsAnalyzing(false);
            }
        }
    }, [itemId, item]);

    // Progress simulation
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isAnalyzing && itemId && activeAnalyses.has(itemId)) {
            const startTime = activeAnalyses.get(itemId)!;
            const estimatedDuration = getEstimatedDuration();

            interval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                let newProgress = (elapsed / estimatedDuration) * 100;

                if (newProgress > 95) {
                    const extraTime = elapsed - estimatedDuration;
                    const creep = 4 * (1 - Math.exp(-extraTime / 10000));
                    newProgress = 95 + creep;
                }

                setProgress(Math.min(99, newProgress));
            }, 100);
        } else if (!isAnalyzing && progress > 0 && progress < 100) {
            setProgress(100);
        }
        return () => clearInterval(interval);
    }, [isAnalyzing, itemId]);

    const processAnalysisResult = async (id: string, analysis: string, syncMetadata: boolean = true) => {
        try {
            let data: any = {};
            try {
                const result = matter(analysis);
                data = result.data;
            } catch (yamlError) {
                console.warn('YAML Frontmatter parsing failed, attempting regex fallback:', yamlError);
                const titleMatch = analysis.match(/^title:\s*["']?(.+?)["']?$/m);
                const publicationMatch = analysis.match(/^publication:\s*["']?(.+?)["']?$/m);
                const yearMatch = analysis.match(/^year:\s*(\d+)/m);
                const doiMatch = analysis.match(/^doi:\s*["']?(.+?)["']?$/m);

                data = {
                    title: titleMatch ? titleMatch[1] : undefined,
                    publication: publicationMatch ? publicationMatch[1] : undefined,
                    year: yearMatch ? parseInt(yearMatch[1]) : undefined,
                    doi: doiMatch ? doiMatch[1] : undefined,
                };
            }

            const updates: Partial<ReferenceItem> = {
                aiAnalysis: analysis,
                dateModified: Date.now()
            };

            // 1. Sync Tags
            if (data.tags && Array.isArray(data.tags)) {
                const currentItem = await db.items.get(id);
                const existingTags = new Set(currentItem?.tags || []);
                data.tags.forEach((tag: string) => existingTags.add(tag));
                updates.tags = Array.from(existingTags);
            }

            // 2. Sync Basic Metadata
            if (syncMetadata) {
                if (data.title) updates.title = data.title;
                if (data.publication) updates.publicationTitle = data.publication;
                if (data.year) updates.date = String(data.year);
                if (data.doi) updates.doi = data.doi;
                if (data.url) updates.url = data.url;

                if (data.authors && Array.isArray(data.authors)) {
                    updates.creators = data.authors.map((auth: string) => {
                        const name = auth.replace(/^\[\[(.*?)\]\]$/, '$1').trim();
                        const parts = name.split(' ');
                        const lastName = parts.pop() || '';
                        const firstName = parts.join(' ');
                        return { firstName, lastName, creatorType: 'author' };
                    });
                }
            }

            await db.items.update(id, updates);
            return updates;
        } catch (error) {
            console.error('Error processing analysis metadata:', error);
            const updates = {
                aiAnalysis: analysis,
                dateModified: Date.now()
            };
            await db.items.update(id, updates);
            return updates;
        }
    };

    const handleAnalyze = async () => {
        if (!itemId || !attachments) return;
        setAnalysisError(null);

        const pdfAttachment = attachments.find(a => a.contentType === 'application/pdf');
        if (!pdfAttachment || !pdfAttachment.data) {
            setAnalysisError('No PDF attachment found to analyze.');
            return;
        }

        let apiKey = localStorage.getItem('gemini_api_key');
        if (!apiKey) {
            apiKey = prompt('Please enter your Google Gemini API Key:');
            if (apiKey) {
                localStorage.setItem('gemini_api_key', apiKey);
            } else {
                return;
            }
        }

        const startTime = Date.now();
        activeAnalyses.set(itemId, startTime);
        setIsAnalyzing(true);
        setProgress(0);

        try {
            const { analyzePdfWithGemini } = await import('@/lib/gemini');
            const modelName = localStorage.getItem('gemini_model') || 'gemini-2.0-flash';

            let pdfBlob = pdfAttachment.data;
            if (!(pdfBlob instanceof Blob) && (pdfBlob as any) instanceof ArrayBuffer) {
                pdfBlob = new Blob([pdfBlob as any], { type: 'application/pdf' });
            }

            if (!(pdfBlob instanceof Blob)) {
                throw new Error('Invalid PDF data format');
            }

            const result = await analyzePdfWithGemini(apiKey, pdfBlob as Blob, modelName);
            await processAnalysisResult(itemId, result);
            saveAnalysisDuration(Date.now() - startTime);

        } catch (error: any) {
            console.error('Analysis failed:', error);
            if (itemId === activeItemIdRef.current) {
                setAnalysisError(error.message || 'Analysis failed.');
            }
        } finally {
            activeAnalyses.delete(itemId);
            if (itemId === activeItemIdRef.current) {
                setIsAnalyzing(false);
            }
        }
    };

    const handleExportMarkdown = () => {
        if (!item?.aiAnalysis) return;

        // Parse existing analysis to get clean content without frontmatter
        let content = item.aiAnalysis;
        try {
            const parsed = matter(item.aiAnalysis);
            // Only use parsed content if it's not empty
            if (parsed.content && parsed.content.trim()) {
                content = parsed.content;
            }
        } catch (e) {
            console.warn('Failed to parse frontmatter for export, using raw content', e);
        }

        // Add title as H1 if content doesn't start with one
        if (content && !content.trim().startsWith('#')) {
            content = `# ${item.title || 'AI Analysis'}\n\n` + content;
        }

        // Format Metadata for YAML Frontmatter
        const authorLinks = item.creators?.map(c =>
            `"[[${c.firstName ? c.firstName + ' ' : ''}${c.lastName || ''}]]"`
        ).join(', ') || '';

        const journal = item.publicationTitle || '';

        let year = '';
        if (item.date) {
            const match = item.date.match(/\d{4}/);
            year = match ? match[0] : '';
        }

        const doi = item.doi || '';
        const urlField = item.url || (doi ? `https://doi.org/${doi}` : '');

        // Generate aliases
        const aliases: string[] = [];
        if (item.shortTitle) aliases.push(`"${item.shortTitle}"`);
        // Add "FirstAuthor Year" alias
        if (item.creators && item.creators.length > 0 && year) {
            aliases.push(`"${item.creators[0].lastName} ${year}"`);
        }
        const aliasesStr = aliases.join(', ');

        const tagsStr = item.tags?.map(t => `"${t}"`).join(', ') || '';

        // Construct YAML
        const yaml = `---\n` +
            `aliases: [${aliasesStr}]\n` +
            `tags: [${tagsStr}]\n` +
            `authors: [${authorLinks}]\n` +
            `publication: "${journal}"\n` +
            `year: ${year}\n` +
            `doi: "${doi}"\n` +
            `url: "${urlField}"\n` +
            `---\n\n`;

        const finalMarkdown = yaml + content;

        const blob = new Blob([finalMarkdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.title || 'analysis'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!isOpen || !itemId) return null;

    return (
        <>

            {!isMinimized && (
                <div
                    className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300"
                    onClick={onClose}
                />
            )}
            <div
                className={cn(
                    "fixed z-50 flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl transition-all duration-300 ease-in-out font-sans overflow-hidden",
                    isMinimized
                        ? "right-6 bottom-6 w-64 h-12"
                        : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] h-[90vh] max-w-7xl"
                )}
            >
                {/* Header */}
                <div
                    className={cn(
                        "flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 transition-colors",
                        isMinimized ? "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/80 border-b-0 h-full" : "cursor-move handle"
                    )}
                    onClick={() => isMinimized && setIsMinimized(false)}
                >
                    <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-medium text-sm select-none flex-1 min-w-0 mr-2">
                        <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <span className="truncate min-w-0">{item?.title || "AI Analysis"}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {item?.aiAnalysis && !isMinimized && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleExportMarkdown();
                                    }}
                                    className="p-1.5 text-zinc-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded hidden sm:flex items-center gap-0.5 relative group"
                                    title="Export as Markdown"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span className="text-[9px] font-bold absolute bottom-0.5 right-0.5 bg-white dark:bg-zinc-900 leading-none px-0.5 rounded shadow-sm border border-zinc-200 dark:border-zinc-700 group-hover:border-blue-200 dark:group-hover:border-blue-800 transition-colors">MD</span>
                                </button>
                                <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700 mx-1 hidden sm:block" />
                            </>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMinimized(!isMinimized);
                            }}
                            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded"
                        >
                            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                            className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                {!isMinimized && (
                    <div className="flex-1 flex flex-col overflow-hidden relative">
                        {/* Progress Bar */}
                        {isAnalyzing && (
                            <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-100 dark:bg-zinc-800 z-10">
                                <div
                                    className="h-full bg-purple-500 transition-all duration-300 ease-out"
                                    style={{ width: `${progress}% ` }}
                                />
                            </div>
                        )}

                        <div id="analysis-printable-content" className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                            {item?.aiAnalysis ? (
                                <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none">
                                    <div className="flex justify-end mb-4 no-print">
                                        <button
                                            onClick={handleAnalyze}
                                            disabled={isAnalyzing}
                                            className="text-xs bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-md flex items-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                                            Regenerate Analysis
                                        </button>
                                    </div>

                                    {analysisError && (
                                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-4">
                                            {analysisError}
                                        </div>
                                    )}

                                    {(() => {
                                        try {
                                            const { content } = matter(item.aiAnalysis);
                                            return <MarkdownRenderer content={content} />;
                                        } catch (e) {
                                            return <MarkdownRenderer content={item.aiAnalysis} />;
                                        }
                                    })()}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-4">
                                        <Sparkles className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                                        No Analysis Yet
                                    </h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mb-8 leading-relaxed">
                                        Generate a comprehensive AI summary and analysis of this paper using Google Gemini.
                                    </p>
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing}
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-purple-500/20 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        {isAnalyzing ? 'Analyzing...' : 'Generate Analysis'}
                                    </button>
                                    {analysisError && (
                                        <p className="text-red-500 text-xs mt-4">{analysisError}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
