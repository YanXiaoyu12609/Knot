import { ReferenceItem, Attachment } from './db';

/**
 * Generate a standardized filename for a PDF based on metadata
 * Format: Author1和Author2 - Year - Title.pdf
 * Example: Coogan和Gillis - 2013 - Evidence that low‐temperature oceanic.pdf
 */
export function generatePdfFilename(item: ReferenceItem): string {
    const parts: string[] = [];

    // Add authors
    if (item.creators && item.creators.length > 0) {
        if (item.creators.length === 1) {
            parts.push(sanitizeFilename(item.creators[0].lastName));
        } else if (item.creators.length === 2) {
            parts.push(
                sanitizeFilename(item.creators[0].lastName) +
                '和' +
                sanitizeFilename(item.creators[1].lastName)
            );
        } else {
            // More than 2 authors: use first author + et al
            parts.push(sanitizeFilename(item.creators[0].lastName) + ' et al');
        }
    }

    // Add year
    if (item.date) {
        const year = new Date(item.date).getFullYear();
        if (!isNaN(year)) {
            parts.push(year.toString());
        }
    }

    // Add title (truncated)
    if (item.title) {
        const truncatedTitle = item.title.length > 80
            ? item.title.substring(0, 80).trim()
            : item.title.trim();
        parts.push(sanitizeFilename(truncatedTitle));
    }

    // Fallback to item ID if no metadata
    if (parts.length === 0) {
        return `Untitled_${item.id.substring(0, 8)}.pdf`;
    }

    return parts.join(' - ') + '.pdf';
}

/**
 * Sanitize a string to be safe for use in filenames
 */
function sanitizeFilename(str: string): string {
    return str
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}

/**
 * Export a PDF attachment with a standardized filename
 */
export async function exportPdf(attachment: Attachment, item: ReferenceItem): Promise<void> {
    if (!attachment.data) {
        throw new Error('No PDF data available');
    }

    const filename = generatePdfFilename(item);
    const blob = attachment.data as Blob;

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Export all PDFs for an item
 */
export async function exportAllPdfs(attachments: Attachment[], item: ReferenceItem): Promise<void> {
    const pdfAttachments = attachments.filter(a => a.contentType === 'application/pdf');

    for (let i = 0; i < pdfAttachments.length; i++) {
        const attachment = pdfAttachments[i];
        const filename = pdfAttachments.length > 1
            ? generatePdfFilename(item).replace('.pdf', `_${i + 1}.pdf`)
            : generatePdfFilename(item);

        if (attachment.data) {
            const blob = attachment.data as Blob;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Small delay between downloads
            if (i < pdfAttachments.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }
}
