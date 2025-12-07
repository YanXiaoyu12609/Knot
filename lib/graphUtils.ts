import { ReferenceItem, Creator } from './db';

export interface GraphNode {
    id: string;
    name: string;
    type: 'paper' | 'author' | 'tag';
    val: number; // Node size
    color: string;
    itemId?: string; // For paper nodes, link back to the item
}

export interface GraphLink {
    source: string;
    target: string;
    color?: string;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

// Normalize author name for comparison
// "Smith, John" vs "Smith, J." -> both normalize to key "smith|j"
function normalizeAuthorKey(creator: Creator): string {
    const lastName = creator.lastName?.trim().toLowerCase() || '';
    const firstName = creator.firstName?.trim().toLowerCase() || '';

    // Get first initial of first name
    const firstInitial = firstName ? firstName.charAt(0) : '';

    return `${lastName}|${firstInitial}`;
}

// Get display name for author (prefer full names)
function getAuthorDisplayName(creator: Creator): string {
    const lastName = creator.lastName?.trim() || 'Unknown';
    const firstName = creator.firstName?.trim() || '';

    if (firstName.length > 2) {
        // Full first name
        return `${lastName}, ${firstName}`;
    } else if (firstName.length > 0) {
        // Initial only
        return `${lastName}, ${firstName.toUpperCase()}.`;
    }
    return lastName;
}

// Build graph data from reference items
export function buildGraphData(items: ReferenceItem[]): GraphData {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Track authors by normalized key -> {id, displayName, fullNameScore}
    const authorMap = new Map<string, { id: string; displayName: string; score: number }>();
    const tagSet = new Set<string>();

    // First pass: collect all authors and find best display names
    items.forEach(item => {
        item.creators?.forEach(creator => {
            const key = normalizeAuthorKey(creator);
            if (!key || key === '|') return;

            const displayName = getAuthorDisplayName(creator);
            const score = (creator.firstName?.length || 0); // Longer first name = higher score

            const existing = authorMap.get(key);
            if (!existing || score > existing.score) {
                authorMap.set(key, {
                    id: `author_${key}`,
                    displayName,
                    score
                });
            }
        });

        // Collect tags
        item.tags?.forEach(tag => {
            if (tag.trim()) {
                tagSet.add(tag.trim().toLowerCase());
            }
        });
    });

    // Create author nodes
    authorMap.forEach((author, key) => {
        nodes.push({
            id: author.id,
            name: author.displayName,
            type: 'author',
            val: 8,
            color: '#22c55e' // Green
        });
    });

    // Create tag nodes
    tagSet.forEach(tag => {
        nodes.push({
            id: `tag_${tag}`,
            name: `#${tag}`,
            type: 'tag',
            val: 6,
            color: '#f97316' // Orange
        });
    });

    // Create paper nodes and links
    items.forEach(item => {
        // Paper node
        const paperNode: GraphNode = {
            id: `paper_${item.id}`,
            name: item.title || 'Untitled',
            type: 'paper',
            val: 10,
            color: '#3b82f6', // Blue
            itemId: item.id
        };
        nodes.push(paperNode);

        // Links to authors
        item.creators?.forEach(creator => {
            const key = normalizeAuthorKey(creator);
            const author = authorMap.get(key);
            if (author) {
                links.push({
                    source: paperNode.id,
                    target: author.id,
                    color: 'rgba(34, 197, 94, 0.3)' // Green with transparency
                });
            }
        });

        // Links to tags
        item.tags?.forEach(tag => {
            const normalizedTag = tag.trim().toLowerCase();
            if (normalizedTag) {
                links.push({
                    source: paperNode.id,
                    target: `tag_${normalizedTag}`,
                    color: 'rgba(249, 115, 22, 0.3)' // Orange with transparency
                });
            }
        });
    });

    return { nodes, links };
}

// Get connected node IDs for highlighting
export function getConnectedNodes(graphData: GraphData, nodeId: string): Set<string> {
    const connected = new Set<string>([nodeId]);

    graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;

        if (sourceId === nodeId) {
            connected.add(targetId);
        } else if (targetId === nodeId) {
            connected.add(sourceId);
        }
    });

    return connected;
}
