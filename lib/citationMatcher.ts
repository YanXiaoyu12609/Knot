import { ParsedReference, ReferenceItem } from './db';

/**
 * Calculate similarity score between a reference and a library item
 * Returns a score between 0 and 1, where 1 is a perfect match
 */
function calculateSimilarity(reference: ParsedReference, item: ReferenceItem): number {
    let score = 0;
    let totalWeight = 0;

    // DOI match (highest priority - if DOIs match, it's the same paper)
    if (reference.doi && item.doi) {
        totalWeight += 10;
        if (reference.doi.toLowerCase() === item.doi.toLowerCase()) {
            score += 10;
        }
    }

    // Year match
    if (reference.year && item.date) {
        totalWeight += 2;
        const itemYear = new Date(item.date).getFullYear().toString();
        if (reference.year === itemYear) {
            score += 2;
        }
    }

    // Title similarity (fuzzy matching)
    if (reference.title && item.title) {
        totalWeight += 5;
        const titleSimilarity = fuzzyMatch(
            normalizeString(reference.title),
            normalizeString(item.title)
        );
        score += titleSimilarity * 5;
    }

    // Author similarity
    if (reference.authors && item.creators && item.creators.length > 0) {
        totalWeight += 3;
        const refAuthors = normalizeString(reference.authors);
        const itemAuthors = item.creators
            .map(c => `${c.lastName} ${c.firstName}`.toLowerCase())
            .join(' ');

        // Check if first author's last name appears
        const firstAuthor = item.creators[0];
        if (firstAuthor && refAuthors.includes(firstAuthor.lastName.toLowerCase())) {
            score += 1.5;
        }

        // Check overall author similarity
        const authorSimilarity = fuzzyMatch(refAuthors, itemAuthors);
        score += authorSimilarity * 1.5;
    }

    if (totalWeight === 0) return 0;
    return score / totalWeight;
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Calculate fuzzy string similarity using Jaccard similarity of word sets
 */
function fuzzyMatch(str1: string, str2: string): number {
    const words1 = new Set(str1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(str2.split(' ').filter(w => w.length > 2));

    if (words1.size === 0 && words2.size === 0) return 1;
    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
}

/**
 * Find matching items in the library for a given reference
 * Returns array of [itemId, similarity score] pairs sorted by score
 */
export function findMatchingItems(
    reference: ParsedReference,
    libraryItems: ReferenceItem[]
): Array<{ itemId: string; similarity: number; item: ReferenceItem }> {
    const matches: Array<{ itemId: string; similarity: number; item: ReferenceItem }> = [];

    for (const item of libraryItems) {
        const similarity = calculateSimilarity(reference, item);

        // Only include if similarity is above threshold (0.5 = 50%)
        if (similarity >= 0.5) {
            matches.push({
                itemId: item.id!,
                similarity,
                item
            });
        }
    }

    // Sort by similarity (highest first)
    return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Match all references against library items
 * Returns a map of reference index to matching items
 */
export function matchReferencesToLibrary(
    references: ParsedReference[],
    libraryItems: ReferenceItem[]
): Map<number, Array<{ itemId: string; similarity: number; item: ReferenceItem }>> {
    const matchMap = new Map<number, Array<{ itemId: string; similarity: number; item: ReferenceItem }>>();

    for (const reference of references) {
        const matches = findMatchingItems(reference, libraryItems);
        if (matches.length > 0) {
            matchMap.set(reference.index, matches);
        }
    }

    return matchMap;
}
