'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from 'lucide-react';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Set worker path
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfViewerProps {
    fileUrl: string;
    onClose: () => void;
}

export function PdfViewer({ fileUrl, onClose }: PdfViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [scale, setScale] = useState<number>(1.2);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    const zoomIn = () => setScale(prev => Math.min(2.5, prev + 0.2));
    const zoomOut = () => setScale(prev => Math.max(0.5, prev - 0.2));

    // Scroll to specific page
    const scrollToPage = (pageNumber: number) => {
        const pageElement = pageRefs.current[pageNumber];
        if (pageElement && containerRef.current) {
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Track current page based on scroll position
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const containerTop = container.scrollTop;
            const containerHeight = container.clientHeight;
            const centerY = containerTop + containerHeight / 2;

            // Find which page is currently in the center of viewport
            for (let i = 1; i <= numPages; i++) {
                const pageElement = pageRefs.current[i];
                if (pageElement) {
                    const rect = pageElement.getBoundingClientRect();
                    const pageTop = pageElement.offsetTop;
                    const pageBottom = pageTop + pageElement.offsetHeight;

                    if (centerY >= pageTop && centerY <= pageBottom) {
                        setCurrentPage(i);
                        break;
                    }
                }
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [numPages]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                if (currentPage > 1) scrollToPage(currentPage - 1);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                if (currentPage < numPages) scrollToPage(currentPage + 1);
            } else if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                zoomIn();
            } else if (e.key === '-') {
                e.preventDefault();
                zoomOut();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, numPages, onClose]);

    return (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
            {/* Header */}
            <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage <= 1}
                        className="p-1.5 hover:bg-zinc-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Previous page (↑)"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <span className="text-sm text-zinc-300 min-w-[100px] text-center">
                        Page {currentPage} of {numPages}
                    </span>

                    <button
                        onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
                        disabled={currentPage >= numPages}
                        className="p-1.5 hover:bg-zinc-800 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Next page (↓)"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={zoomOut}
                        className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
                        title="Zoom out (-)"
                    >
                        <ZoomOut className="w-5 h-5" />
                    </button>

                    <span className="text-sm text-zinc-300 w-12 text-center">
                        {Math.round(scale * 100)}%
                    </span>

                    <button
                        onClick={zoomIn}
                        className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
                        title="Zoom in (+)"
                    >
                        <ZoomIn className="w-5 h-5" />
                    </button>
                </div>

                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-zinc-800 rounded transition-colors"
                    title="Close (Esc)"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* PDF Content - Continuous Scroll */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto bg-zinc-950"
            >
                <div className="flex flex-col items-center py-8 gap-4">
                    <Document
                        file={fileUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={
                            <div className="text-zinc-500 text-center py-12">
                                Loading PDF...
                            </div>
                        }
                        error={
                            <div className="text-red-400 text-center py-12">
                                Failed to load PDF
                            </div>
                        }
                    >
                        {Array.from(new Array(numPages), (el, index) => {
                            const pageNum = index + 1;
                            // Only render pages close to current page (virtualization)
                            // Buffer of 2 pages before and after
                            const shouldRender = Math.abs(currentPage - pageNum) <= 2;

                            return (
                                <div
                                    key={`page_${pageNum}`}
                                    ref={(el) => { pageRefs.current[pageNum] = el; }}
                                    className="mb-4 flex justify-center"
                                    style={{
                                        // Estimate height to prevent scroll jumping
                                        // A4 ratio is ~1.414. Width is roughly 600px * scale?
                                        // Better to let it flow but keep container
                                        minHeight: shouldRender ? 'auto' : `${800 * scale}px`
                                    }}
                                >
                                    {shouldRender ? (
                                        <Page
                                            pageNumber={pageNum}
                                            scale={scale}
                                            renderTextLayer={true}
                                            renderAnnotationLayer={true}
                                            className="shadow-2xl"
                                            loading={
                                                <div
                                                    className="bg-white/5 animate-pulse rounded"
                                                    style={{
                                                        width: `${600 * scale}px`,
                                                        height: `${840 * scale}px`
                                                    }}
                                                />
                                            }
                                        />
                                    ) : (
                                        <div
                                            className="flex items-center justify-center text-zinc-700 bg-zinc-900/50 rounded border border-zinc-800"
                                            style={{
                                                width: `${600 * scale}px`,
                                                height: `${840 * scale}px`
                                            }}
                                        >
                                            <span className="text-sm">Page {pageNum}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </Document>
                </div>
            </div>
        </div>
    );
}
