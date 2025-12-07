import { pdfjs } from 'react-pdf';
import { ParsedReference } from './db';

// Initialize PDF.js worker
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

const DOI_REGEX = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi;

// Common patterns for reference section headers
const REFERENCE_SECTION_PATTERNS = [
    /^references?\s*$/i,
    /^bibliography\s*$/i,
    /^works?\s+cited\s*$/i,
    /^literature\s+cited\s*$/i,
    /^citations?\s*$/i,
    /^参考文献\s*$/,
    /^引用文献\s*$/,
];

// Patterns for numbered references like [1], 1., (1), etc.
const REFERENCE_NUMBER_PATTERNS = [
    /^\[(\d+)\]\s*/,           // [1] Author...
    /^(\d+)\.\s+/,             // 1. Author...
    /^\((\d+)\)\s*/,           // (1) Author...
    /^(\d+)\s+/,               // 1 Author... (less common)
];

/**
 * Extract text content from all pages of a PDF
 */
async function extractPdfText(pdfData: Blob): Promise<string[]> {
    const arrayBuffer = await pdfData.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pageTexts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ');
        pageTexts.push(text);
    }

    return pageTexts;
}

/**
 * Find the start of the references section in the text
 */
function findReferencesSection(text: string): number {
    const lines = text.split(/[.\n]/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        for (const pattern of REFERENCE_SECTION_PATTERNS) {
            if (pattern.test(line)) {
                // Return the position after this line
                return text.indexOf(line) + line.length;
            }
        }
    }

    return -1;
}

/**
 * Parse individual references from the references section text
 */
function parseReferences(referencesText: string): ParsedReference[] {
    const references: ParsedReference[] = [];

    // Try to split by reference number patterns first (for numbered formats)
    let lines = referencesText.split(/(?=\[\d+\]|(?:^|\n)\d+\.|(?:^|\n)\(\d+\))/).filter(l => l.trim());

    // If we didn't find numbered references, try splitting by author-year pattern
    if (lines.length < 3) {
        // Try pattern with year in parentheses: Lastname, I. (Year)
        const patternWithParen = /(?=(?:^|\s)[A-Z][a-z]+,\s+[A-Z]\.[^.]{0,100}?\(\d{4}\))/;
        lines = referencesText.split(patternWithParen).filter(l => l.trim());

        // If still not enough, try pattern with year followed by period: Lastname, I., Year.
        if (lines.length < 3) {
            const patternWithPeriod = /(?=(?:^|\s)[A-Z][a-z]{2,},\s+[A-Z]\.[^.]{0,100}?,\s+\d{4}\.)/;
            lines = referencesText.split(patternWithPeriod).filter(l => l.trim());
        }

        // Last fallback: simpler pattern
        if (lines.length < 3) {
            lines = referencesText.split(/(?=\s[A-Z][a-z]{2,},\s+[A-Z]\.)/).filter(l => l.trim());
        }
    }

    for (const line of lines) {
        const trimmed = line.trim();

        // Basic length filter - not too short, not excessively long
        if (!trimmed || trimmed.length < 20 || trimmed.length > 1000) continue;

        // Must contain a year
        if (!/\b\d{4}\b/.test(trimmed)) continue;

        let index = references.length + 1;
        let text = trimmed;

        // Try to extract the reference number (for numbered formats)
        for (const pattern of REFERENCE_NUMBER_PATTERNS) {
            const match = trimmed.match(pattern);
            if (match) {
                index = parseInt(match[1], 10);
                text = trimmed.replace(pattern, '').trim();
                break;
            }
        }

        // Extract DOI if present
        const doiMatches = text.match(DOI_REGEX);
        const doi = doiMatches ? doiMatches[0] : undefined;

        // Try to extract year (prefer parentheses, then followed by period)
        const yearMatchParen = text.match(/\((\d{4})\)/);
        const yearMatchPeriod = text.match(/,\s+(\d{4})\./);
        const yearMatchAny = text.match(/\b(\d{4})\b/);
        const year = yearMatchParen ? yearMatchParen[1] :
            (yearMatchPeriod ? yearMatchPeriod[1] :
                (yearMatchAny ? yearMatchAny[1] : undefined));

        // Try to extract title
        let title: string | undefined;
        if (year) {
            const afterYearMatch = text.match(new RegExp(`${year}[).]*\\s+["']?([^."]{10,150})["']?(?:\\.|In:)`));
            if (afterYearMatch && afterYearMatch[1]) {
                title = afterYearMatch[1].trim().substring(0, 200);
            }
        }

        // Extract authors - text before the year
        let authors: string | undefined;
        if (year) {
            const yearPattern = new RegExp(`(.+?)(?:\\(${year}\\)|,?\\s+${year}[.)])`);
            const authorMatch = text.match(yearPattern);
            if (authorMatch && authorMatch[1]) {
                authors = authorMatch[1]
                    .replace(/^(and\s+|from\s+)?/, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 250);
            }
        }

        // Skip if missing critical information
        if (!year) continue;

        // Also skip if authors look suspicious (too short or contains weird patterns)
        if (authors && (authors.length < 3 || /^\d/.test(authors))) {
            authors = undefined;
        }

        references.push({
            index,
            text: text.substring(0, 500),
            doi,
            authors,
            title,
            year
        });
    }

    return references;
}

/**
 * Main function to extract references from a PDF
 */
export async function extractReferencesFromPdf(pdfData: Blob): Promise<ParsedReference[]> {
    try {
        const pageTexts = await extractPdfText(pdfData);
        const fullText = pageTexts.join(' ');

        // Find the references section
        let refStart = findReferencesSection(fullText);

        // If not found, try multiple fallback methods
        if (refStart === -1) {
            // Focus on the last 15% of the document where references are typically located
            const lastPartStart = Math.floor(fullText.length * 0.85);
            const lastPart = fullText.substring(lastPartStart);

            // Fallback 1: Look for numbered references [1] or 1. 
            const numberedRefPattern = /(?:\[1\]|(?:^|\n)1\.|^\(1\))\s+[A-Z]/m;
            let match = lastPart.match(numberedRefPattern);

            if (match && match.index !== undefined) {
                refStart = lastPartStart + match.index;
            }

            // Fallback 2: Look for dense author-year citations
            if (refStart === -1) {
                // Look for multiple occurrences of "Lastname, I.I., ...Year." pattern
                // This is a strong signal of a reference list
                const authorYearPattern = /[A-Z][a-z]+,\s+[A-Z]\.[A-Z]\.(?:[A-Z]\.)?.*?\d{4}\./g;
                const matches = [...lastPart.matchAll(authorYearPattern)];

                // If we find at least 5 such patterns, it's likely references
                if (matches.length >= 5) {
                    // Find where the dense cluster starts
                    // Look for first match that has another match within 200 chars
                    for (let i = 0; i < matches.length - 1; i++) {
                        const currentMatch = matches[i];
                        const nextMatch = matches[i + 1];

                        if (currentMatch.index !== undefined && nextMatch.index !== undefined) {
                            const gap = nextMatch.index - (currentMatch.index + currentMatch[0].length);

                            // If matches are close together (< 300 chars), likely a reference list
                            if (gap < 300) {
                                // Back up to start of line
                                const beforeMatch = lastPart.substring(0, currentMatch.index);
                                const lineStart = beforeMatch.lastIndexOf('\n');
                                refStart = lastPartStart + (lineStart >= 0 ? lineStart + 1 : currentMatch.index);
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (refStart === -1) {
            // Last resort: assume last 10% is references
            const lastResortStart = Math.floor(fullText.length * 0.9);
            const referencesText = fullText.substring(lastResortStart);
            const references = parseReferences(referencesText);

            if (references.length > 0) {
                return references;
            }

            return [];
        }

        // Extract text after the references start
        const referencesText = fullText.substring(refStart);

        // Parse individual references
        const references = parseReferences(referencesText);

        return references;
    } catch (error) {
        console.error('Error extracting references from PDF:', error);
        return [];
    }
}

/**
 * Check if the extracted references are likely incomplete
 * (e.g., too few references for a typical paper)
 */
export function areReferencesIncomplete(references: ParsedReference[]): boolean {
    // Most papers have at least 10 references
    // If we found less than 5, it's likely incomplete
    return references.length < 5;
}
