export function parseConversation(rawJson) {
    let data;
    try {
        data = JSON.parse(rawJson);
    } catch (e) {
        throw new Error("Invalid JSON");
    }

    const chunks = data.chunkedPrompt?.chunks || [];
    const prompts = [];
    
    chunks.forEach((chunk, index) => {
        // Identify User Prompts (User role + has content)
        if (chunk.role === 'user' && (chunk.text || chunk.driveDocument || chunk.driveImage)) {
            // Check if it's the start of a user turn (prev chunk was model or start of file)
            if (index === 0 || chunks[index - 1].role !== 'user') {
                prompts.push({
                    ...chunk,
                    originalIndex: index
                });
            }
        }
    });
    
    return { data, prompts };
}

export function getCleanJSON(parsedData) {
    if (!parsedData || !parsedData.chunkedPrompt?.chunks) return null;
    return parsedData.chunkedPrompt.chunks.map(chunk => {
        if (chunk.inlineData) {
            return {
                role: chunk.role,
                inlineImage: "Image data omitted."
            };
        }
        if (chunk.driveDocument) {
            return {
                role: chunk.role,
                driveDocument: `File ID: ${chunk.driveDocument.id}`
            };
        }
        if (chunk.driveImage) {
            return {
                role: chunk.role,
                driveImage: `File ID: ${chunk.driveImage.id}`
            };
        }
        return {
            role: chunk.role,
            text: chunk.text
        };
    });
}

export function generateMetadataHTML(parsedData) {
    const settings = parsedData.runSettings || {};
    let settingsHtml = '';

    if (Object.keys(settings).length === 0) {
        settingsHtml = '<p style="color:var(--text-faint)">No settings found.</p>';
    } else {
        Object.entries(settings).forEach(([k, v]) => {
            if (k === 'safetySettings') {
                settingsHtml += `
                    <div style="padding:12px 0; border-bottom:1px solid var(--border-subtle);">
                        <span style="color:var(--text-muted); font-weight:500;">safetySettings</span>
                        ${formatSafetySettings(v)}
                    </div>`;
            } else {
                settingsHtml += `
                    <div class="meta-item">
                        <span class="meta-key">${k}</span>
                        <span class="meta-value">${typeof v === 'object' ? JSON.stringify(v) : v}</span>
                    </div>`;
            }
        });
    }

    const sys = parsedData.systemInstruction;
    let sysText = sys ? (sys.text || (sys.parts ? sys.parts.map(p => p.text).join('\n') : '')) : '';
    const sysHtml = sysText ? window.marked.parse(sysText) : '<p style="color:var(--text-faint)">No instructions found.</p>';

    const cites = parsedData.citations || [];
    const citesHtml = cites.map(c => `<li><a href="${c.uri}" target="_blank" style="color:var(--accent-primary)">${c.uri}</a></li>`).join('');
    const finalCites = citesHtml ? `<ul>${citesHtml}</ul>` : '<p style="color:var(--text-faint)">No citations found.</p>';

    return { settingsHtml, sysHtml, citesHtml: finalCites };
}

export function extractMedia(parsedData) {
    if (!parsedData || !parsedData.chunkedPrompt?.chunks) return [];
    
    const media = [];
    
    parsedData.chunkedPrompt.chunks.forEach((chunk, idx) => {
        // 1. Inline Data (Base64) - usually User uploads
        if (chunk.inlineData) {
            media.push({
                type: 'inline',
                mimeType: chunk.inlineData.mimeType,
                data: chunk.inlineData.data,
                role: chunk.role,
                index: idx,
                ext: getExtensionFromMime(chunk.inlineData.mimeType)
            });
        }
        // 2. Inline Image (Base64) - usually Model generation
        if (chunk.inlineImage) {
            media.push({
                type: 'inline',
                mimeType: chunk.inlineImage.mimeType,
                data: chunk.inlineImage.data,
                role: chunk.role,
                index: idx,
                ext: getExtensionFromMime(chunk.inlineImage.mimeType)
            });
        }
        // 3. Drive Document
        if (chunk.driveDocument) {
            media.push({
                type: 'drive',
                mimeType: chunk.driveDocument.mimeType,
                id: chunk.driveDocument.id,
                role: chunk.role,
                index: idx,
                ext: getExtensionFromMime(chunk.driveDocument.mimeType)
            });
        }
        // 4. Drive Image
        if (chunk.driveImage) {
             media.push({
                type: 'drive',
                mimeType: chunk.driveImage.mimeType,
                id: chunk.driveImage.id,
                role: chunk.role,
                index: idx,
                ext: getExtensionFromMime(chunk.driveImage.mimeType)
            });
        }
    });
    
    return media;
}

function getExtensionFromMime(mime) {
    if (!mime) return 'bin';
    if (mime.includes('png')) return 'png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('gif')) return 'gif';
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('text/plain')) return 'txt';
    return mime.split('/')[1] || 'bin';
}

function formatSafetySettings(settingsArray) {
    if (!Array.isArray(settingsArray) || settingsArray.length === 0) return '<div class="safety-grid"><span style="color:var(--text-faint)">No safety settings provided.</span></div>';

    let html = '<div class="safety-grid">';
    settingsArray.forEach(s => {
        const category = s.category.replace('HARM_CATEGORY_', '').replace(/_/g, ' ');
        const threshold = s.threshold || 'UNKNOWN';

        let badgeClass = 'off';
        if (threshold.includes('BLOCK_NONE')) badgeClass = 'block-none';
        else if (threshold.includes('BLOCK_ONLY_HIGH')) badgeClass = 'block-high';
        else if (threshold.includes('BLOCK_MEDIUM')) badgeClass = 'block-med';
        else if (threshold.includes('BLOCK_LOW')) badgeClass = 'block-low';

        const readableThreshold = threshold.replace('BLOCK_', '').replace(/_/g, ' ');

        html += `
            <div class="safety-card">
                <span class="safety-category">${category}</span>
                <span class="safety-badge ${badgeClass}">${readableThreshold}</span>
            </div>
        `;
    });
    html += '</div>';
    return html;
}