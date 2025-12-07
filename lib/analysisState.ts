// Global state to track active analyses across component re-renders/item switches
export const activeAnalyses = new Map<string, number>(); // itemId -> startTime

// Helper for analysis duration statistics
const DURATION_STORAGE_KEY = 'gemini_analysis_durations';
const DEFAULT_DURATION = 15000; // 15 seconds default

export function getEstimatedDuration(): number {
    if (typeof window === 'undefined') return DEFAULT_DURATION;
    try {
        const stored = localStorage.getItem(DURATION_STORAGE_KEY);
        if (!stored) return DEFAULT_DURATION;
        const durations = JSON.parse(stored) as number[];
        if (durations.length === 0) return DEFAULT_DURATION;
        // Average of last 10 runs
        return durations.reduce((a, b) => a + b, 0) / durations.length;
    } catch {
        return DEFAULT_DURATION;
    }
}

export function saveAnalysisDuration(duration: number) {
    if (typeof window === 'undefined') return;
    try {
        // Filter outliers: ignore if < 2s (likely error/cache) or > 120s (too long)
        if (duration < 2000 || duration > 120000) return;

        const stored = localStorage.getItem(DURATION_STORAGE_KEY);
        let durations = stored ? JSON.parse(stored) as number[] : [];
        durations.push(duration);
        // Keep last 10
        if (durations.length > 10) durations = durations.slice(-10);
        localStorage.setItem(DURATION_STORAGE_KEY, JSON.stringify(durations));
    } catch (e) {
        console.error('Failed to save analysis duration', e);
    }
}
