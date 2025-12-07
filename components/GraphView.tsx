'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ReferenceItem } from '@/lib/db';
import { buildGraphData, getConnectedNodes, GraphNode, GraphData } from '@/lib/graphUtils';
import { X, ZoomIn, ZoomOut, Maximize2, GraduationCap, Search, Users, Tag, FileText } from 'lucide-react';
import { DetailPanel } from './DetailPanel';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphViewProps {
    items: ReferenceItem[];
    onSelectItem: (id: string) => void;
    onClose: () => void;
}

export function GraphView({ items, onSelectItem, onClose }: GraphViewProps) {
    const fgRef = useRef<any>(null);
    const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
    const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
    const [showAuthors, setShowAuthors] = useState(true);
    const [showTags, setShowTags] = useState(true);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [selectedAuthor, setSelectedAuthor] = useState<{ name: string; lastName: string } | null>(null);

    // Build graph data
    const graphData = useMemo(() => {
        const fullData = buildGraphData(items);

        // Filter based on visibility settings
        const filteredNodes = fullData.nodes.filter(node => {
            if (node.type === 'author' && !showAuthors) return false;
            if (node.type === 'tag' && !showTags) return false;
            return true;
        });

        const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredLinks = fullData.links.filter(link => {
            const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
            const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
            return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
        });

        return { nodes: filteredNodes, links: filteredLinks };
    }, [items, showAuthors, showTags]);

    // Handle node click
    const handleNodeClick = useCallback((node: any) => {
        if (node.type === 'paper' && node.itemId) {
            // Instead of closing graph, show details in side panel
            setSelectedItemId(node.itemId);
            setSelectedAuthor(null);
        } else if (node.type === 'author') {
            // Extract lastName from "LastName, FirstName" format
            const lastName = node.name.split(',')[0].trim();
            setSelectedAuthor({ name: node.name, lastName });
            setSelectedItemId(null);
        } else {
            // Clicking non-paper/author nodes clears selection
            setSelectedItemId(null);
            setSelectedAuthor(null);
        }

        // Highlight connected nodes
        const connected = getConnectedNodes(graphData, node.id);
        setHighlightNodes(connected);

        // Focus camera on node
        if (fgRef.current) {
            fgRef.current.centerAt(node.x, node.y, 500);
            fgRef.current.zoom(2, 500);
        }
    }, [graphData]);

    // Handle background click to clear selection
    const handleBackgroundClick = useCallback(() => {
        setSelectedItemId(null);
        setSelectedAuthor(null);
        setHighlightNodes(new Set());
    }, []);

    // Handle node hover
    const handleNodeHover = useCallback((node: any) => {
        setHoverNode(node || null);
        if (node) {
            const connected = getConnectedNodes(graphData, node.id);
            setHighlightNodes(connected);
        } else {
            // Only clear highlight if no item is selected
            if (!selectedItemId && !selectedAuthor) {
                setHighlightNodes(new Set());
            } else {
                // Restore highlight for selected item/author
                let targetId = null;
                if (selectedItemId) {
                    const selectedNode = graphData.nodes.find(n => n.itemId === selectedItemId);
                    if (selectedNode) targetId = selectedNode.id;
                } else if (selectedAuthor) {
                    const selectedNode = graphData.nodes.find(n => n.type === 'author' && n.name === selectedAuthor.name);
                    if (selectedNode) targetId = selectedNode.id;
                }

                if (targetId) {
                    const connected = getConnectedNodes(graphData, targetId);
                    setHighlightNodes(connected);
                }
            }
        }
    }, [graphData, selectedItemId, selectedAuthor]);

    // Node canvas render
    const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const label = node.name;
        const fontSize = Math.max(12 / globalScale, 2);
        const isHighlighted = highlightNodes.has(node.id);
        const isSelected = node.itemId === selectedItemId || (node.type === 'author' && selectedAuthor && node.name === selectedAuthor.name);
        const isDimmed = highlightNodes.size > 0 && !isHighlighted;

        // Node circle
        const radius = node.val / 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

        if (isSelected) {
            ctx.fillStyle = '#fff'; // White for selected
        } else {
            ctx.fillStyle = isDimmed ? 'rgba(100, 100, 100, 0.3)' : node.color;
        }
        ctx.fill();

        // Highlight ring
        if (isHighlighted || isSelected) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = (isSelected ? 3 : 1.5) / globalScale;
            ctx.stroke();
        }

        // Label
        if (isHighlighted || isSelected || globalScale > 1.5) {
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isDimmed ? 'rgba(150, 150, 150, 0.3)' : '#fff';
            ctx.fillText(label, node.x, node.y + radius + fontSize);
        }
    }, [highlightNodes, selectedItemId, selectedAuthor]);

    // Link color
    const getLinkColor = useCallback((link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;

        if (highlightNodes.size > 0) {
            if (highlightNodes.has(sourceId) && highlightNodes.has(targetId)) {
                return 'rgba(255, 255, 255, 0.5)';
            }
            return 'rgba(100, 100, 100, 0.1)';
        }
        return link.color || 'rgba(150, 150, 150, 0.2)';
    }, [highlightNodes]);

    // Zoom controls
    const handleZoomIn = () => {
        if (fgRef.current) {
            const currentZoom = fgRef.current.zoom();
            fgRef.current.zoom(currentZoom * 1.5, 300);
        }
    };

    const handleZoomOut = () => {
        if (fgRef.current) {
            const currentZoom = fgRef.current.zoom();
            fgRef.current.zoom(currentZoom / 1.5, 300);
        }
    };

    const handleFitView = () => {
        if (fgRef.current) {
            fgRef.current.zoomToFit(400, 50);
        }
    };

    // Fit view on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            if (fgRef.current) {
                fgRef.current.zoomToFit(400, 50);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    // Stats
    const stats = useMemo(() => {
        const papers = graphData.nodes.filter(n => n.type === 'paper').length;
        const authors = graphData.nodes.filter(n => n.type === 'author').length;
        const tags = graphData.nodes.filter(n => n.type === 'tag').length;
        return { papers, authors, tags };
    }, [graphData]);

    return (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
            <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <h2 className="text-zinc-200 font-medium">Literature Graph</h2>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> {stats.papers} Papers</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> {stats.authors} Authors</span>
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> {stats.tags} Tags</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-zinc-800 rounded-md p-1">
                        <button
                            onClick={() => setShowAuthors(!showAuthors)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${showAuthors ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Authors
                        </button>
                        <button
                            onClick={() => setShowTags(!showTags)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${showTags ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Tags
                        </button>
                    </div>

                    <div className="flex items-center gap-1">
                        <button onClick={handleZoomOut} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200">
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <button onClick={handleFitView} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200">
                            <Maximize2 className="w-4 h-4" />
                        </button>
                        <button onClick={handleZoomIn} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200">
                            <ZoomIn className="w-4 h-4" />
                        </button>
                    </div>

                    <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
                <ForceGraph2D
                    ref={fgRef}
                    graphData={graphData}
                    nodeLabel="name"
                    nodeColor="color"
                    nodeVal="val"
                    linkColor={getLinkColor}
                    onNodeClick={handleNodeClick}
                    onNodeHover={handleNodeHover}
                    onBackgroundClick={handleBackgroundClick}
                    nodeCanvasObject={paintNode}
                    cooldownTicks={100}
                    d3AlphaDecay={0.02}
                    d3VelocityDecay={0.3}
                />

                {hoverNode && (
                    <div className="absolute bottom-4 left-4 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 max-w-md pointer-events-none z-10">
                        <div className="flex items-center gap-2 mb-1">
                            {hoverNode.type === 'paper' && <FileText className="w-4 h-4 text-blue-500" />}
                            {hoverNode.type === 'author' && <Users className="w-4 h-4 text-green-500" />}
                            {hoverNode.type === 'tag' && <Tag className="w-4 h-4 text-orange-500" />}
                            <span className="text-xs text-zinc-500 uppercase">{hoverNode.type}</span>
                        </div>
                        <p className="text-sm text-zinc-200">{hoverNode.name}</p>
                        {hoverNode.type === 'paper' && (
                            <p className="text-xs text-zinc-500 mt-1">Click for details</p>
                        )}
                    </div>
                )}

                {selectedItemId && (
                    <div className="absolute top-0 right-0 h-full z-20 shadow-xl">
                        <DetailPanel
                            itemId={selectedItemId}
                            onClose={() => setSelectedItemId(null)}
                        />
                    </div>
                )}

                {selectedAuthor && (
                    <div className="absolute top-0 right-0 w-96 h-full bg-zinc-900 border-l border-zinc-800 shadow-xl z-20 flex flex-col">
                        <div className="p-6 border-b border-zinc-800">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-zinc-100">{selectedAuthor.name}</h2>
                                <button onClick={() => setSelectedAuthor(null)} className="text-zinc-500 hover:text-zinc-300">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <a
                                    href={`https://scholar.google.com/scholar?q=${encodeURIComponent(selectedAuthor.name)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors group"
                                >
                                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 group-hover:bg-blue-500/30 transition-colors">
                                        <GraduationCap className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-zinc-200">Google Scholar</div>
                                        <div className="text-xs text-zinc-500">Search for publications</div>
                                    </div>
                                </a>

                                <a
                                    href={`https://www.researchgate.net/search?q=${encodeURIComponent(selectedAuthor.name)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors group"
                                >
                                    <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 group-hover:bg-green-500/30 transition-colors">
                                        <Search className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-zinc-200">ResearchGate</div>
                                        <div className="text-xs text-zinc-500">Find researcher profile</div>
                                    </div>
                                </a>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                                Related Papers ({selectedAuthor.lastName ? items.filter(item =>
                                    item.creators.some(c =>
                                        c.lastName?.toLowerCase() === selectedAuthor.lastName.toLowerCase()
                                    )
                                ).length : 0})
                            </h3>
                            <div className="space-y-3">
                                {selectedAuthor.lastName && items
                                    .filter(item =>
                                        item.creators.some(c =>
                                            c.lastName?.toLowerCase() === selectedAuthor.lastName.toLowerCase()
                                        )
                                    )
                                    .map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                setSelectedItemId(item.id);
                                                setSelectedAuthor(null);
                                            }}
                                            className="p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors group"
                                        >
                                            <div className="flex items-start gap-2">
                                                <FileText className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-zinc-200 line-clamp-2 group-hover:text-blue-400 transition-colors">
                                                        {item.title}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 mt-1">
                                                        {item.date} {item.publicationTitle && `· ${item.publicationTitle}`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
