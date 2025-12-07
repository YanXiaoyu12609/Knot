import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css'; // Import KaTeX styles
import { Info, AlertTriangle, CheckCircle, Flame, Lightbulb, FileText, AlertOctagon, HelpCircle } from 'lucide-react';

interface MarkdownRendererProps {
    content: string;
}

// Callout configuration
const CALLOUT_TYPES: Record<string, { icon: React.ElementType, color: string, title: string, bg: string, border: string }> = {
    note: { icon: FileText, color: 'text-blue-400', title: 'Note', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    abstract: { icon: FileText, color: 'text-cyan-400', title: 'Abstract', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
    info: { icon: Info, color: 'text-blue-400', title: 'Info', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    todo: { icon: CheckCircle, color: 'text-blue-400', title: 'Todo', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    tip: { icon: Flame, color: 'text-emerald-400', title: 'Tip', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    success: { icon: CheckCircle, color: 'text-green-400', title: 'Success', bg: 'bg-green-500/10', border: 'border-green-500/30' },
    question: { icon: HelpCircle, color: 'text-orange-400', title: 'Question', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    warning: { icon: AlertTriangle, color: 'text-orange-400', title: 'Warning', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    failure: { icon: X, color: 'text-red-400', title: 'Failure', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    danger: { icon: AlertOctagon, color: 'text-red-400', title: 'Danger', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    bug: { icon: AlertOctagon, color: 'text-red-400', title: 'Bug', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    example: { icon: FileText, color: 'text-purple-400', title: 'Example', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
    quote: { icon: FileText, color: 'text-zinc-400', title: 'Quote', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30' },
    idea: { icon: Lightbulb, color: 'text-yellow-400', title: 'Idea', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
};

import { X } from 'lucide-react'; // Import X separately as it was used in CALLOUT_TYPES

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
    return (
        <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none space-y-4">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    // Custom Blockquote for Callouts
                    blockquote: ({ node, children, ...props }: any) => {
                        // We need to check if the first child is a paragraph containing the callout syntax
                        const firstChild = React.Children.toArray(children)[0] as React.ReactElement;

                        if (firstChild && firstChild.props && firstChild.props.node && firstChild.props.node.tagName === 'p') {
                            const textContent = firstChild.props.children[0];

                            if (typeof textContent === 'string') {
                                const match = textContent.match(/^\[!(.*?)\]\s*(.*)$/);

                                if (match) {
                                    const type = match[1].toLowerCase();
                                    const title = match[2] || '';
                                    const config = CALLOUT_TYPES[type] || CALLOUT_TYPES.note;
                                    const Icon = config.icon;

                                    // Remove the first line (the callout definition) from the content
                                    // This is tricky with React children.
                                    // A simpler approach for this specific structure:
                                    // The first child is the <p>[!type] Title</p>.
                                    // But often the content follows in the same p or subsequent elements.
                                    // Actually, standard markdown parsing puts the `[!type]` inside the first paragraph of the blockquote.

                                    // Let's try to render the children but filter out the callout marker from the first paragraph.
                                    const filteredChildren = React.Children.map(children, (child, index) => {
                                        if (index === 0 && React.isValidElement(child)) {
                                            const childProps = child.props as any;
                                            if (childProps.children && Array.isArray(childProps.children)) {
                                                // If it's an array, the first element is usually the text node with the marker
                                                const [firstText, ...rest] = childProps.children;
                                                if (typeof firstText === 'string' && firstText.startsWith(`[!${match[1]}]`)) {
                                                    // If there is a title, the rest of the line is the title, which we display in the header.
                                                    // The content *inside* the callout usually starts on the next line (next paragraph) or after the title.
                                                    // If it's just `[!info] Title`, then this paragraph is just the header.
                                                    // If there is content, it might be in `rest` or subsequent children.
                                                    if (rest.length === 0) return null; // Just header
                                                    return React.cloneElement(child, { ...childProps, children: rest });
                                                }
                                            } else if (typeof childProps.children === 'string') {
                                                if (childProps.children.startsWith(`[!${match[1]}]`)) {
                                                    return null; // Just header line
                                                }
                                            }
                                        }
                                        return child;
                                    });

                                    return (
                                        <div className={`my-4 rounded-md border ${config.border} ${config.bg} overflow-hidden`}>
                                            <div className={`flex items-center gap-2 px-4 py-2 border-b ${config.border} bg-black/10`}>
                                                <Icon className={`w-4 h-4 ${config.color}`} />
                                                <span className={`font-semibold text-sm ${config.color}`}>
                                                    {title || config.title}
                                                </span>
                                            </div>
                                            <div className="p-4 text-zinc-700 dark:text-zinc-300 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
                                                {filteredChildren}
                                            </div>
                                        </div>
                                    );
                                }
                            }
                        }

                        // Default blockquote
                        return (
                            <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-700 pl-4 italic text-zinc-600 dark:text-zinc-400 my-4" {...props}>
                                {children}
                            </blockquote>
                        );
                    },
                    // Code Blocks
                    code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                            <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-md !bg-zinc-100 dark:!bg-zinc-900 !p-4 border border-zinc-200 dark:border-zinc-800 text-sm"
                                {...props}
                            >
                                {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                        ) : (
                            <code className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                {children}
                            </code>
                        );
                    },
                    // Tables
                    table: ({ children, ...props }) => (
                        <div className="overflow-x-auto my-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800" {...props}>
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children, ...props }) => (
                        <thead className="bg-zinc-50 dark:bg-zinc-900" {...props}>
                            {children}
                        </thead>
                    ),
                    th: ({ children, ...props }) => (
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider" {...props}>
                            {children}
                        </th>
                    ),
                    td: ({ children, ...props }) => (
                        <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap border-t border-zinc-200 dark:border-zinc-800" {...props}>
                            {children}
                        </td>
                    ),
                    // Links
                    a: ({ children, ...props }) => (
                        <a className="text-blue-400 hover:text-blue-300 hover:underline transition-colors" {...props}>
                            {children}
                        </a>
                    ),
                    // Headings
                    h1: ({ children, ...props }) => <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-8 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800" {...props}>{children}</h1>,
                    h2: ({ children, ...props }) => <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-6 mb-3" {...props}>{children}</h2>,
                    h3: ({ children, ...props }) => <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mt-5 mb-2" {...props}>{children}</h3>,
                    // Lists
                    ul: ({ children, ...props }) => <ul className="list-disc list-inside space-y-1 text-zinc-700 dark:text-zinc-300 my-4 pl-2" {...props}>{children}</ul>,
                    ol: ({ children, ...props }) => <ol className="list-decimal list-inside space-y-1 text-zinc-700 dark:text-zinc-300 my-4 pl-2" {...props}>{children}</ol>,
                    li: ({ children, ...props }) => <li className="pl-1" {...props}>{children}</li>,
                    // Paragraphs with Callout support
                    p: ({ children, ...props }) => {
                        // Check if the paragraph starts with a callout syntax
                        // Be careful with React children structure
                        const childrenArray = React.Children.toArray(children);
                        const firstChild = childrenArray[0];

                        if (typeof firstChild === 'string') {
                            const match = firstChild.match(/^\[!(.*?)\]\s*(.*?)(\n|$)/);
                            if (match) {
                                const type = match[1].toLowerCase();
                                const title = match[2] || '';
                                const config = CALLOUT_TYPES[type] || CALLOUT_TYPES.note;
                                const Icon = config.icon;

                                // Filter out the callout syntax from the first child text
                                const cleanedFirstChild = firstChild.replace(/^\[!(.*?)\]\s*(.*?)(\n|$)/, '');

                                // Reconstruct children without the callout marker
                                const remainingChildren = [cleanedFirstChild, ...childrenArray.slice(1)].filter(Boolean);

                                return (
                                    <div className={`my-4 rounded-md border ${config.border} ${config.bg} overflow-hidden`}>
                                        <div className={`flex items-center gap-2 px-4 py-2 border-b ${config.border} bg-black/5`}>
                                            <Icon className={`w-4 h-4 ${config.color}`} />
                                            <span className={`font-semibold text-sm ${config.color}`}>
                                                {title || config.title}
                                            </span>
                                        </div>
                                        <div className="p-4 text-zinc-700 dark:text-zinc-300">
                                            {remainingChildren}
                                        </div>
                                    </div>
                                );
                            }
                        }

                        return <p className="leading-relaxed text-zinc-900 dark:text-zinc-50 my-3" {...props}>{children}</p>;
                    },
                    // Horizontal Rule
                    hr: ({ ...props }) => <hr className="border-zinc-200 dark:border-zinc-800 my-8" {...props} />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
