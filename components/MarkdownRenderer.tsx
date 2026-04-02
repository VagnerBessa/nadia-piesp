import React from 'react';

// This function parses inline markdown like **bold** and *italic*.
const parseInlineFormatting = (text: string) => {
    // Regex to find **bold** or *italic* text. Using non-greedy match.
    const parts = text.split(/(\*\*.+?\*\*|\*.+?\*)/g);

    return parts.filter(part => part).map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
            return <em key={index}>{part.slice(1, -1)}</em>;
        }
        return part;
    });
};


interface MarkdownRendererProps {
    content: string;
}

/**
 * A component to render markdown content from the AI model.
 * It groups lines into paragraphs or lists and applies inline formatting.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    const blocks: { type: 'p' | 'ul'; lines: string[] }[] = [];
    const lines = content.split('\n');
    let currentBlock: { type: 'p' | 'ul'; lines: string[] } | null = null;

    for (const line of lines) {
        const trimmedLine = line.trim();
        const isListItem = trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ');

        if (isListItem) {
            // If the current block is not a list, create a new one.
            if (currentBlock?.type !== 'ul') {
                currentBlock = { type: 'ul', lines: [] };
                blocks.push(currentBlock);
            }
            // Add the list item content (without the marker).
            currentBlock.lines.push(trimmedLine.substring(2));
        } else if (trimmedLine.length > 0) {
            // If the current block is not a paragraph, create a new one.
            if (currentBlock?.type !== 'p') {
                currentBlock = { type: 'p', lines: [] };
                blocks.push(currentBlock);
            }
            currentBlock.lines.push(line);
        } else {
            // An empty line signifies a break between blocks.
            currentBlock = null;
        }
    }

    return (
        <div className="leading-relaxed space-y-2">
            {blocks.map((block, index) => {
                if (block.type === 'ul') {
                    return (
                        <ul key={index} className="list-disc list-inside space-y-1 pl-2">
                            {block.lines.map((item, i) => (
                                <li key={i}>{parseInlineFormatting(item)}</li>
                            ))}
                        </ul>
                    );
                }
                if (block.type === 'p') {
                    // Join lines with <br /> to preserve line breaks within a paragraph.
                    return (
                        <p key={index}>
                            {block.lines.map((line, i) => (
                                <React.Fragment key={i}>
                                    {parseInlineFormatting(line)}
                                    {i < block.lines.length - 1 && <br />}
                                </React.Fragment>
                            ))}
                        </p>
                    );
                }
                return null;
            })}
        </div>
    );
};