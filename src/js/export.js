/* global htmlToImage */
import { showToast } from './utils.js';

/**
 * Exports a set of chunks as Markdown
 */
export function exportToMarkdown(chunks, filename) {
    const md = chunksToMarkdown(chunks);
    downloadString(md, `${filename}.md`, 'text/markdown');
}

/**
 * Exports a set of chunks as Plain Text
 */
export function exportToTxt(chunks, filename) {
    const txt = chunksToTxt(chunks);
    downloadString(txt, `${filename}.txt`, 'text/plain');
}

/**
 * Exports a set of chunks or an element as HTML
 */
export function exportToHtml(element, title, filename) {
    const styles = Array.from(document.styleSheets)
        .map(sheet => {
            try {
                return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
            } catch (e) {
                // Skip cross-origin stylesheets if they can't be read
                return '';
            }
        }).join('\n');

    // Add Highlight.js theme
    const themeLink = document.getElementById('highlight-stylesheet');
    const themeUrl = themeLink ? themeLink.href : '';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <link rel="stylesheet" href="${themeUrl}">
    <style>
        body { font-family: 'Inter', sans-serif; padding: 40px; background: var(--bg-app, #f8fafc); color: var(--text-main, #0f172a); }
        ${styles}
        .message-tooltip, .code-header-actions, .collapse-code-btn { display: none !important; }
        .message { max-width: 800px; margin: 0 auto; }
    </style>
</head>
<body data-theme="${document.documentElement.getAttribute('data-theme') || 'light'}">
    <div class="content-wrapper">
        ${element.innerHTML}
    </div>
</body>
</html>`;

    downloadString(html, `${filename}.html`, 'text/html');
}

/**
 * Trigger browser print for PDF
 */
export function exportToPdf() {
    window.print();
}

/**
 * Export element as Image
 */
export async function exportToImage(element, filename) {
    try {
        // Hide tooltips and actions before capture
        const tooltips = element.querySelectorAll('.message-tooltip, .code-header-actions, .collapse-code-btn');
        tooltips.forEach(t => t.style.display = 'none');

        const dataUrl = await htmlToImage.toPng(element, {
            backgroundColor: getComputedStyle(document.body).backgroundColor,
            style: {
                transform: 'scale(1)',
                padding: '20px'
            }
        });

        // Restore tooltips
        tooltips.forEach(t => t.style.display = '');

        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = dataUrl;
        link.click();
    } catch (error) {
        console.error('Image export failed:', error);
        showToast('Image export failed', 'error');
    }
}

// --- Internal Helpers ---

function chunksToMarkdown(chunks) {
    return chunks.map(chunk => {
        let content = '';
        if (chunk.text) {
            content = chunk.text;
        } else if (chunk.inlineData || chunk.inlineImage) {
            const type = (chunk.inlineData || chunk.inlineImage).mimeType || 'image';
            content = `\n![Attached ${type}](Embedded Data)\n`;
        } else if (chunk.driveDocument || chunk.driveImage || chunk.driveAudio || chunk.driveVideo || chunk.driveFile) {
            const data = chunk.driveDocument || chunk.driveImage || chunk.driveAudio || chunk.driveVideo || chunk.driveFile;
            content = `\n[Drive Attachment: ${data.id}]\n`;
        } else if (chunk.inlineFile) {
            content = `\n[Attached File: ${chunk.inlineFile.mimeType}]\n`;
        }

        const prefix = chunk.role === 'user' ? '### User\n' : (chunk.isThought ? '### Thinking\n' : '### Gemini\n');
        return prefix + content;
    }).join('\n\n');
}

function chunksToTxt(chunks) {
    return chunks.map(chunk => {
        let content = '';
        if (chunk.text) {
            // Very simple markdown to text conversion (remove backticks and asterisks)
            content = chunk.text.replace(/([_*~`])/g, '');
        } else if (chunk.inlineData || chunk.inlineImage) {
            content = `[Attached Image/Media]`;
        } else if (chunk.driveDocument || chunk.driveImage || chunk.driveAudio || chunk.driveVideo || chunk.driveFile) {
            const data = chunk.driveDocument || chunk.driveImage || chunk.driveAudio || chunk.driveVideo || chunk.driveFile;
            content = `[Drive Attachment: ${data.id}]`;
        } else if (chunk.inlineFile) {
            content = `[Attached File]`;
        }

        const prefix = chunk.role === 'user' ? 'USER: ' : (chunk.isThought ? 'THINKING: ' : 'GEMINI: ');
        return prefix + content;
    }).join('\n\n');
}

function downloadString(content, filename, contentType) {
    const a = document.createElement('a');
    const blob = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
