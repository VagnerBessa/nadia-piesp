import React from 'react';
import { EmbeddedChart } from './EmbeddedChart';

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
    const blocks: { type: 'p' | 'ul' | 'h1' | 'h2' | 'h3' | 'chart'; lines: string[]; chartData?: any }[] = [];
    const lines = content.split('\n');
    let currentBlock: { type: 'p' | 'ul' | 'h1' | 'h2' | 'h3' | 'chart'; lines: string[]; chartData?: any } | null = null;
    let inChartBlock = false;

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('```json-chart')) {
            inChartBlock = true;
            currentBlock = { type: 'chart', lines: [] };
            blocks.push(currentBlock);
            continue;
        }

        if (inChartBlock) {
            if (trimmedLine.startsWith('```')) {
                inChartBlock = false;
                try {
                    const jsonStr = currentBlock!.lines.join('\n');
                    currentBlock!.chartData = JSON.parse(jsonStr);
                } catch (e) {
                    console.error("Failed to parse json-chart block:", e);
                }
                currentBlock = null;
            } else {
                currentBlock!.lines.push(line);
            }
            continue;
        }

        const isListItem = trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ');
        const isH3 = trimmedLine.startsWith('### ');
        const isH2 = trimmedLine.startsWith('## ');
        const isH1 = trimmedLine.startsWith('# ');

        if (isH1 || isH2 || isH3) {
            // Treat headers as standalone blocks
            blocks.push({
                type: isH3 ? 'h3' : isH2 ? 'h2' : 'h1',
                lines: [trimmedLine.replace(/^#+\s/, '')]
            });
            currentBlock = null;
        } else if (isListItem) {
            if (currentBlock?.type !== 'ul') {
                currentBlock = { type: 'ul', lines: [] };
                blocks.push(currentBlock);
            }
            currentBlock.lines.push(trimmedLine.substring(2));
        } else if (trimmedLine.length > 0) {
            if (currentBlock?.type !== 'p') {
                currentBlock = { type: 'p', lines: [] };
                blocks.push(currentBlock);
            }
            currentBlock.lines.push(line);
        } else {
            currentBlock = null;
        }
    }

    return (
        <div className="leading-relaxed space-y-3">
            {blocks.map((block, index) => {
                if (block.type === 'chart') {
                    if (!block.chartData) return null;
                    return (
                        <EmbeddedChart
                            key={index}
                            title={block.chartData.title}
                            type={block.chartData.type}
                            data={block.chartData.data}
                        />
                    );
                }
                if (block.type === 'h3') {
                    return <h3 key={index} className="text-sm font-semibold text-slate-200 mt-4 mb-1">{parseInlineFormatting(block.lines[0])}</h3>;
                }
                if (block.type === 'h2') {
                    return <h2 key={index} className="text-base font-bold text-white mt-5 mb-2 pb-1 border-b border-slate-600/50 flex flex-row items-center gap-2"><span className="w-1 h-3.5 bg-rose-500 rounded-full inline-block flex-shrink-0" />{parseInlineFormatting(block.lines[0])}</h2>;
                }
                if (block.type === 'h1') {
                    return <h1 key={index} className="text-lg font-bold text-white mt-6 mb-3">{parseInlineFormatting(block.lines[0])}</h1>;
                }
                if (block.type === 'ul') {
                    return (
                        <ul key={index} className="list-disc list-inside space-y-1.5 pl-2">
                            {block.lines.map((item, i) => (
                                <li key={i}>{parseInlineFormatting(item)}</li>
                            ))}
                        </ul>
                    );
                }
                if (block.type === 'p') {
                    return (
                        <p key={index} className="text-slate-300">
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