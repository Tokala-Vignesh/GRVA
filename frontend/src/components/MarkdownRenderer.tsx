import React from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Helper to parse inline markdown (bold, code, links, badges)
  const renderInline = (text: string): React.ReactNode[] => {
    // Regex for bold **text**, code `code`, link [text](url) or raw url
    const tokens: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Pattern matches:
    // 1: `code`
    // 2: **bold**
    // 3: [link text](url)
    // 4: https?://...
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s]+)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push(text.substring(lastIndex, match.index));
      }

      const matchText = match[0];
      if (matchText.startsWith('`') && matchText.endsWith('`')) {
        const code = matchText.slice(1, -1);
        tokens.push(
          <code
            key={`inline-code-${key++}`}
            className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/80 font-mono text-[11px] text-cyan-300 select-all"
          >
            {code}
          </code>
        );
      } else if (matchText.startsWith('**') && matchText.endsWith('**')) {
        const bold = matchText.slice(2, -2);
        tokens.push(
          <strong key={`bold-${key++}`} className="font-bold text-slate-100">
            {bold}
          </strong>
        );
      } else if (matchText.startsWith('[') && matchText.includes('](')) {
        const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(matchText);
        if (linkMatch) {
          const [, label, url] = linkMatch;
          tokens.push(
            <a
              key={`link-${key++}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 inline-flex items-center gap-0.5"
            >
              <span>{label}</span>
              <ExternalLink className="w-2.5 h-2.5 inline" />
            </a>
          );
        }
      } else if (matchText.startsWith('http')) {
        tokens.push(
          <a
            key={`raw-url-${key++}`}
            href={matchText}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 break-all inline-flex items-center gap-0.5 font-mono text-[11px]"
          >
            <span>{matchText}</span>
            <ExternalLink className="w-2.5 h-2.5 inline" />
          </a>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      tokens.push(text.substring(lastIndex));
    }

    return tokens.length > 0 ? tokens : [text];
  };

  // Split lines and group blocks: tables, codeblocks, lists, paragraphs
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Block ```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const fullCode = codeLines.join('\n');
      const curKey = blockKey++;
      elements.push(
        <div key={`code-block-${curKey}`} className="my-3 rounded-xl overflow-hidden border border-slate-800 bg-[#090D18]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0D1424] border-b border-slate-800 text-[10px] text-slate-400 font-mono">
            <span>{lang || 'code'}</span>
            <button
              onClick={() => handleCopy(fullCode, curKey)}
              className="flex items-center gap-1 hover:text-cyan-400 transition"
              title="Copy code"
            >
              {copiedIdx === curKey ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3 text-[11px] font-mono text-slate-200 overflow-x-auto whitespace-pre">
            {fullCode}
          </pre>
        </div>
      );
      continue;
    }

    // 2. Markdown Table Detection (| col1 | col2 |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        // Parse header
        const headerCells = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());

        // Parse rows (skipping delimiter line if it has ---)
        const rowLines = tableLines.slice(1).filter((l) => !l.includes('---') && !l.includes(':---'));
        const rows = rowLines.map((row) =>
          row
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
        );

        elements.push(
          <div key={`table-${blockKey++}`} className="my-3 overflow-x-auto rounded-xl border border-slate-800 bg-[#0D1424]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#090D18] text-slate-300 font-semibold border-b border-slate-800">
                <tr>
                  {headerCells.map((h, hIdx) => (
                    <th key={`th-${hIdx}`} className="py-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {rows.map((row, rIdx) => (
                  <tr key={`tr-${rIdx}`} className="hover:bg-slate-800/40 transition">
                    {row.map((cell, cIdx) => (
                      <td key={`td-${rIdx}-${cIdx}`} className="py-2 px-3 text-[11px]">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 3. Headings (#, ##, ###)
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h4-${blockKey++}`} className="text-xs font-bold text-slate-100 mt-2.5 mb-1 flex items-center gap-1.5">
          {renderInline(line.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={`h3-${blockKey++}`} className="text-sm font-bold text-slate-100 mt-3 mb-1.5 flex items-center gap-2">
          {renderInline(line.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={`h2-${blockKey++}`} className="text-base font-bold text-slate-100 mt-3.5 mb-2">
          {renderInline(line.slice(2))}
        </h2>
      );
      i++;
      continue;
    }

    // 4. Bullet lists (*, -)
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('* ') || lines[i].trim().startsWith('- '))) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${blockKey++}`} className="space-y-1 my-1.5 pl-2">
          {listItems.map((item, idx) => (
            <li key={`li-${idx}`} className="flex items-start gap-2 text-[11px] text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
              <div className="leading-relaxed">{renderInline(item)}</div>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 5. Divider ---
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={`hr-${blockKey++}`} className="my-3 border-slate-800" />);
      i++;
      continue;
    }

    // 6. Regular text / paragraph
    if (line.trim().length > 0) {
      elements.push(
        <p key={`p-${blockKey++}`} className="text-[11px] text-slate-200 leading-relaxed my-1">
          {renderInline(line)}
        </p>
      );
    } else {
      // Empty line spacer
      elements.push(<div key={`space-${blockKey++}`} className="h-1" />);
    }

    i++;
  }

  return <div className="space-y-0.5 text-slate-200 leading-normal">{elements}</div>;
};
