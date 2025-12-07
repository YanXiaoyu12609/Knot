import Cite from 'citation-js';
import { ReferenceItem } from './db';

// Map internal types to CSL types
const TYPE_MAP: Record<string, string> = {
    'journalArticle': 'article-journal',
    'book': 'book',
    'webpage': 'webpage',
    'report': 'report',
    'thesis': 'thesis'
};

function mapItemToCSL(item: ReferenceItem) {
    const issued = item.date ? { 'date-parts': [[parseInt(item.date.split('-')[0])]] } : undefined;

    return {
        id: item.id,
        type: TYPE_MAP[item.type] || 'article',
        title: item.title,
        author: item.creators?.map(c => ({
            family: c.lastName,
            given: c.firstName
        })),
        'container-title': item.publicationTitle,
        DOI: item.doi,
        URL: item.url,
        issued: issued,
        abstract: item.abstract
    };
}

export function generateBibliography(items: ReferenceItem[], format: 'bibtex' | 'json' | 'text'): string {
    const cslItems = items.map(mapItemToCSL);
    const cite = new Cite(cslItems);

    try {
        if (format === 'bibtex') {
            return cite.format('bibtex');
        } else if (format === 'json') {
            return cite.format('data');
        } else {
            // Text format (APA-like style by default if available, or just simple text)
            // citation-js defaults to APA
            return cite.format('bibliography', {
                format: 'text',
                template: 'apa',
                lang: 'en-US'
            });
        }
    } catch (e) {
        console.error('Bibliography generation failed:', e);
        return 'Error generating bibliography';
    }
}
