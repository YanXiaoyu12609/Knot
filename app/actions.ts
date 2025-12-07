'use server';


import { cleanTitle } from '@/lib/utils';
import { MetadataResult } from '@/lib/metadata';

export async function fetchMetadataByDoiAction(doi: string): Promise<MetadataResult | null> {
    try {
        // Use native fetch with CSL-JSON content negotiation to avoid citation-js sync-fetch issues in server actions
        const response = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
            headers: {
                'Accept': 'application/vnd.citationstyles.csl+json'
            }
        });

        if (!response.ok) {
            console.error(`DOI fetch failed: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const item = Array.isArray(data) ? data[0] : data;

        // Parse authors
        const creators = item.author?.map((author: any) => ({
            firstName: author.given || '',
            lastName: author.family || author.literal || '',
            creatorType: 'author' as const
        })) || [];

        const title = item.title || item['title-short'];
        const publicationTitle = item['container-title'] || item.publisher;

        return {
            title: title ? cleanTitle(title) : title,
            creators,
            date: item.issued?.['date-parts']?.[0]?.join('-') || item.issued?.raw,
            publicationTitle: publicationTitle ? cleanTitle(publicationTitle) : publicationTitle,
            doi: item.DOI,
            abstract: item.abstract,
            type: item.type === 'article-journal' ? 'journalArticle' : 'journalArticle'
        };
    } catch (error) {
        console.error('Error fetching metadata by DOI (Server Action):', error);
        return null;
    }
}
