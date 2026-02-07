export function truncate(str, n) {
    if (!str) return '';
    return (str.length > n) ? str.substr(0, n - 1) + '...' : str;
}

export function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard');
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

export function showToast(message, iconClass = 'ph-fill ph-check-circle') {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toast-msg');
    const icon = toast.querySelector('i');

    if (toast && msg && icon) {
        msg.textContent = message;
        icon.className = iconClass;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

export function updateUrl(id) {
    try {
        const newUrl = new URL(window.location);
        // Clear old params
        newUrl.searchParams.delete('id');
        newUrl.searchParams.delete('chat');

        if (id) {
            newUrl.searchParams.set('view', id);
        } else {
            newUrl.searchParams.delete('view');
        }
        window.history.pushState({}, '', newUrl);
    } catch (e) {
        console.error("Failed to update URL", e);
    }
}