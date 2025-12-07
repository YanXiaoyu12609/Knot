import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Map of common HTML subscripts to Unicode subscripts
const subscriptMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ', 'h': 'ₕ',
    'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'p': 'ₚ',
    's': 'ₛ', 't': 'ₜ'
};

// Map of common HTML superscripts to Unicode superscripts
const superscriptMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ'
};

/**
 * Clean and normalize a title string by:
 * - Converting HTML sub/sup tags to Unicode characters
 * - Normalizing whitespace
 * - Removing other HTML tags
 */
export function cleanTitle(title: string | any): string {
    if (!title) return '';

    let cleaned = String(title);

    // Convert <sub>...</sub> tags to Unicode subscripts
    cleaned = cleaned.replace(/<sub>(.*?)<\/sub>/gi, (_, content) => {
        return content.split('').map((char: string) => subscriptMap[char] || char).join('');
    });

    // Convert <sup>...</sup> tags to Unicode superscripts
    cleaned = cleaned.replace(/<sup>(.*?)<\/sup>/gi, (_, content) => {
        return content.split('').map((char: string) => superscriptMap[char] || char).join('');
    });

    // Remove any remaining HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    // Normalize whitespace: replace multiple spaces/newlines with single space
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Trim leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned;
}
