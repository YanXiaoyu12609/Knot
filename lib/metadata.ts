import { pdfjs } from 'react-pdf';
import { cleanTitle } from './utils';
import { fetchMetadataByDoiAction } from '@/app/actions';

// Initialize PDF.js worker
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface MetadataResult {
    title?: string;
    creators?: Array<{ firstName: string; lastName: string; creatorType: 'author' }>;
    date?: string;
    publicationTitle?: string;
    doi?: string;
    abstract?: string;
    type?: string;
}

const DOI_REGEX = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;

export async function extractMetadataFromPdf(file: File): Promise<MetadataResult | null> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

        // Get text from first page to find DOI
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');

        const doiMatch = text.match(DOI_REGEX);

        if (doiMatch) {
            return await fetchMetadataByDoi(doiMatch[0]);
        }

        // Fallback: try to use PDF metadata
        const metadata = await pdf.getMetadata();
        if (metadata.info) {
            const title = (metadata.info as any).Title;
            return {
                title: title ? cleanTitle(title) : title,
            };
        }

        return null;
    } catch (error) {
        console.error('Error extracting metadata from PDF:', error);
        return null;
    }
}

export async function fetchMetadataByDoi(doi: string): Promise<MetadataResult | null> {
    return await fetchMetadataByDoiAction(doi);
}
