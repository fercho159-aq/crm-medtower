// Configurar DayJS
dayjs.extend(window.dayjs_plugin_relativeTime);

// Helper to format phone/JID for display
function formatPhoneForDisplay(tel) {
    if (!tel) return '';
    return tel.replace('@s.whatsapp.net', '').replace('@lid', '');
}

// State
let currentLeads = [];
let activeFilter = 'ALL';
let activeBrand = 'ALL';
let currentLeadIdForMessage = null; // Consolidates lead details ID
let currentEditingTags = [];
let knownLeadAlerts = {}; // Tracks leadId -> alertClass
let currentBotConfig = null; // Bot settings cache
let waStatusModalInterval = null; // WhatsApp connections modal fast polling interval
let socket = null;

let userRole = 'vendedor';
let userId = null;
let activeVendedorFilter = 'ALL';
let activeVendedorStatusFilter = 'ALL';
let currentSearchQuery = '';
let activeStartDate = '';
let activeEndDate = '';
let onlyMyLeads = false;
let allSellers = [];

// Dynamic Bot Status Sync
function syncBotStatusUI(config) {
    if (!config) return;
    const isPrincipalEnabled = config.enabled_principal !== false;

    // Update internal modal checkbox
    const togglePrincipal = document.getElementById('bot-enabled-principal');
    const statusTextPrincipal = document.getElementById('status-text-principal');

    if (togglePrincipal) togglePrincipal.checked = isPrincipalEnabled;

    if (statusTextPrincipal) {
        statusTextPrincipal.textContent = isPrincipalEnabled ? "ACTIVO" : "APAGADO";
        statusTextPrincipal.className = isPrincipalEnabled ? "text-[10px] font-bold uppercase tracking-wider text-neon" : "text-[10px] font-bold uppercase tracking-wider text-gray-500";
    }

    const headerBtn = document.getElementById('header-bot-toggle');
    const indicator = document.getElementById('header-bot-indicator');
    const textSpan = document.getElementById('header-bot-toggle-text');

    if (!headerBtn || !indicator || !textSpan) return;

    const isHeaderActive = isPrincipalEnabled;
    const headerText = `🤖 Bot: ${isPrincipalEnabled ? 'ACTIVO' : 'APAGADO'}`;
    
    if (isHeaderActive) {
        // Active Styles (Glowing Emerald/Green)
        headerBtn.className = "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-300 font-bold border border-emerald-500/40 text-emerald-400 bg-emerald-950/25 hover:border-emerald-400 hover:text-emerald-300";
        indicator.innerHTML = `
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        `;
    } else {
        // Inactive Styles (Slate/Muted Red)
        headerBtn.className = "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-300 font-bold border border-red-950/60 text-red-400 bg-red-950/10 hover:border-red-900/60 hover:bg-red-950/20";
        indicator.innerHTML = `
            <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        `;
    }
    textSpan.textContent = headerText;
}

async function fetchBotConfig() {
    try {
        const res = await fetch('/api/bot/flow');
        const data = await res.json();
        if (res.ok && data.success) {
            currentBotConfig = data.data;
            syncBotStatusUI(currentBotConfig);
        }
    } catch (error) {
        console.error('Error fetching bot config:', error);
    }
}

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const leadsTableBody = document.getElementById('leads-table-body');
const refreshBtn = document.getElementById('refresh-btn');
const filterBtns = document.querySelectorAll('.filter-btn');
const brandBtns = document.querySelectorAll('.brand-btn');
const messageModal = document.getElementById('message-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const sendModalBtn = document.getElementById('send-modal-btn');
const manualMessageText = document.getElementById('manual-message-text');
const modalLeadInfo = document.getElementById('modal-lead-info');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    initSocket();
    // Poll every 10 seconds silently
    setInterval(() => {
        const dashboardVisible = !dashboardScreen.classList.contains('hidden');
        if (dashboardVisible) {
            fetchLeads(true);
            fetchWhatsAppStatus(true);
            fetchSellersGoals();
            fetchMonthlyBusinessKpis();
        }
    }, 10000);
});

function initSocket() {
    try {
        socket = io();
        
        socket.on('connect', () => {
            console.log('[Socket] Conectado al servidor de tiempo real');
        });
        
        socket.on('new_message', (msg) => {
            console.log('[Socket] Nuevo mensaje recibido:', msg);
            // Si el mensaje pertenece al lead actualmente abierto, agregarlo al chat
            if (currentLeadIdForMessage && Number(currentLeadIdForMessage) === Number(msg.lead_id)) {
                appendMessageToContainer(msg);
                scrollChatToBottom();
            }
        });
        
        socket.on('lead_updated', (data) => {
            console.log('[Socket] Lead actualizado, refrescando lista:', data);
            fetchLeads(true);
        });

        socket.on('disconnect', () => {
            console.log('[Socket] Desconectado del servidor de tiempo real');
        });
    } catch (err) {
        console.error('Error al inicializar Socket.io:', err);
    }
}

// Auth API Calls
async function checkSession() {
    try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        
        if (data.authenticated) {
            userRole = data.role || 'vendedor';
            userId = data.userId || null;
            showDashboard();
            fetchLeads();
            fetchBotConfig();
            fetchWhatsAppStatus();
            fetchSellers();
            fetchSellersGoals();
            fetchMonthlyBusinessKpis();
        } else {
            showLogin();
        }
    } catch (error) {
        showLogin();
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        if (data.success) {
            loginError.classList.add('hidden');
            await checkSession();
        } else {
            loginError.textContent = data.error || 'Error logging in';
            loginError.classList.remove('hidden');
        }
    } catch (error) {
        loginError.textContent = 'Server error';
        loginError.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        showLogin();
    } catch (error) {
        console.error('Logout error', error);
    }
});

// UI Switches
function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
}

function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    
    const manageBtn = document.getElementById('manage-sellers-btn');
    const filterVendedorDiv = document.getElementById('filter-vendedor')?.parentElement;
    const myClientsTab = document.getElementById('my-clients-btn');
    const dashboardBtn = document.getElementById('dashboard-btn');
    const parrillaBtn = document.getElementById('parrilla-btn');
    const configBtn = document.getElementById('config-btn');
    const whatsappStatusBtn = document.getElementById('whatsapp-status-btn');
    
    if (userRole === 'content_manager') {
        if (dashboardBtn) dashboardBtn.classList.add('hidden');
        if (configBtn) configBtn.classList.add('hidden');
        if (whatsappStatusBtn) whatsappStatusBtn.classList.add('hidden');
        if (manageBtn) manageBtn.classList.add('hidden');
        if (filterVendedorDiv) filterVendedorDiv.classList.add('hidden');
        if (myClientsTab) myClientsTab.classList.add('hidden');
        
        // Auto navigate to parrilla
        if (parrillaBtn) parrillaBtn.click();
    } else if (userRole === 'admin') {
        if (dashboardBtn) dashboardBtn.classList.remove('hidden');
        if (configBtn) configBtn.classList.remove('hidden');
        if (whatsappStatusBtn) whatsappStatusBtn.classList.remove('hidden');
        if (manageBtn) manageBtn.classList.remove('hidden');
        if (filterVendedorDiv) filterVendedorDiv.classList.remove('hidden');
        if (myClientsTab) myClientsTab.classList.remove('hidden');
    } else {
        if (dashboardBtn) dashboardBtn.classList.remove('hidden');
        if (configBtn) configBtn.classList.remove('hidden');
        if (whatsappStatusBtn) whatsappStatusBtn.classList.remove('hidden');
        if (manageBtn) manageBtn.classList.add('hidden');
        if (filterVendedorDiv) filterVendedorDiv.classList.add('hidden');
        if (myClientsTab) myClientsTab.classList.remove('hidden');
    }
}

// Data Fetching
async function fetchLeads(silent = false) {
    if (userRole === 'content_manager') return;
    if (!silent) {
        leadsTableBody.innerHTML = `<tr><td colspan="7" class="py-10 text-center"><div class="flex justify-center"><div class="loader"></div></div></td></tr>`;
    }
    try {
        const sellerParam = onlyMyLeads ? 'ME' : activeVendedorFilter;
        const queryUrl = `/api/leads?status=${activeFilter}&brand=${activeBrand}&vendedor=${sellerParam}&vendedor_status=${activeVendedorStatusFilter}&search=${encodeURIComponent(currentSearchQuery)}&start_date=${activeStartDate}&end_date=${activeEndDate}`;
        const res = await fetch(queryUrl);
        const data = await res.json();
        if (data.success) {
            const previousLeads = [...currentLeads];
            currentLeads = data.data;
            renderLeads();
            fetchSellersGoals();
            fetchMonthlyBusinessKpis();
            if (previousLeads.length > 0) {
                checkForNewAlerts(previousLeads);
            }
        }
    } catch (error) {
        if (!silent) {
            leadsTableBody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-red-500">Error cargando leads.</td></tr>`;
        }
    }
}

function checkForNewAlerts(previousLeads) {
    const prevMap = {};
    previousLeads.forEach(l => {
        prevMap[l.id] = getAlertClass(l);
    });

    currentLeads.forEach(lead => {
        const currentAlert = getAlertClass(lead);
        const prevAlert = prevMap[lead.id] || 'alert-normal';

        // Detect if alert level increased
        if (currentAlert !== 'alert-normal' && currentAlert !== prevAlert) {
            if (currentAlert === 'alert-red') {
                showToast(`🔴 Atención Urgente: ${lead.nombre}`, `El cliente requiere atención humana hace más de 30 minutos.`, 'red');
                playAlertSound();
            } else if (currentAlert === 'alert-yellow') {
                showToast(`🟡 Seguimiento: ${lead.nombre}`, `El bot envió el último mensaje hace más de 2 horas sin respuesta.`, 'yellow');
                playAlertSound();
            }
        }
    });
}

function playAlertSound() {
    const audio = document.getElementById('alert-sound');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(err => console.log('Audio playback pending user click.'));
    }
}

function showToast(title, message, color) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const borderCol = color === 'red' ? 'border-red-500' : 'border-yellow-500';
    const bgCol = color === 'red' ? 'bg-red-950/90' : 'bg-yellow-950/90';
    const icon = color === 'red' ? 'bx-error-circle text-red-500 animate-pulse' : 'bx-time-five text-yellow-500';

    toast.className = `p-4 rounded-lg border-l-4 ${borderCol} ${bgCol} text-white shadow-2xl flex gap-3 transform translate-y-2 opacity-0 transition-all duration-300 backdrop-blur-md mb-2`;
    toast.innerHTML = `
        <div class="text-xl flex items-center justify-center">
            <i class='bx ${icon}'></i>
        </div>
        <div class="flex-grow">
            <h4 class="font-bold text-sm leading-tight">${title}</h4>
            <p class="text-xs text-gray-300 mt-1">${message}</p>
        </div>
        <button class="text-gray-400 hover:text-white self-start" onclick="this.parentElement.remove()">
            <i class='bx bx-x text-lg'></i>
        </button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 6000);
}

function getAlertClass(lead) {
    const updated = dayjs(lead.fecha_actualizacion);
    const now = dayjs();
    const diffHours = now.diff(updated, 'hour');
    const diffMinutes = now.diff(updated, 'minute');

    if (lead.estado_atencion === 'RESUELTO') return 'alert-normal';

    // ALERTA ROJA: Si ultimo_emisor = 'CLIENTE' y fecha_actualizacion > 30 min (Atención humana urgente)
    if (lead.ultimo_emisor === 'CLIENTE' && diffMinutes > 30) {
        return 'alert-red';
    }

    // ALERTA AMARILLA: Si ultimo_emisor = 'BOT' y fecha_actualizacion > 2 horas (Abandono de carrito/lead)
    if (lead.ultimo_emisor === 'BOT' && diffHours >= 2) {
        return 'alert-yellow';
    }

    return 'alert-normal';
}

function renderLeads() {
    if (currentLeads.length === 0) {
        leadsTableBody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-gray-500">No hay leads para mostrar.</td></tr>`;
        return;
    }

    leadsTableBody.innerHTML = currentLeads.map(lead => {
        const alertClass = getAlertClass(lead);
        const timeAgo = dayjs(lead.fecha_actualizacion).fromNow();
        
        let statusBadge = '';
        if (lead.estado_atencion === 'PENDIENTE') statusBadge = '<span class="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs">Pendiente</span>';
        if (lead.estado_atencion === 'EN_CURSO') statusBadge = '<span class="px-2 py-1 bg-blue-900/50 text-blue-300 border border-blue-800 rounded text-xs">En Curso</span>';
        if (lead.estado_atencion === 'RESUELTO') statusBadge = '<span class="px-2 py-1 bg-green-900/50 text-green-300 border border-green-800 rounded text-xs">Resuelto</span>';

        let dot = '';
        if (alertClass === 'alert-red') {
            dot = `<span class="inline-flex w-2.5 h-2.5 rounded-full bg-red-500 mr-2 relative"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span></span>`;
        } else if (alertClass === 'alert-yellow') {
            dot = `<span class="inline-flex w-2.5 h-2.5 rounded-full bg-yellow-500 mr-2"></span>`;
        }

        const accountBadge = `<span class="ml-2 px-1.5 py-0.5 bg-teal-950/40 text-teal-400 border border-teal-900/60 rounded text-[10px] font-semibold uppercase tracking-wider">${lead.cuenta || 'Principal'}</span>`;

        const leadTags = lead.tags ? lead.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        const tagsHtml = leadTags.map(tag => `
            <span class="inline-block bg-gray-800 text-gray-400 text-[9px] font-bold px-1 py-0.5 rounded border border-gray-700 uppercase tracking-wider scale-95">${tag}</span>
        `).join(' ');

        // Seller Assignment display
        const assignedSeller = lead.vendedor_nombre ? 
            `<span class="px-2 py-0.5 bg-purple-900/30 text-purple-300 border border-purple-800/40 rounded text-xs font-medium inline-flex items-center gap-1 w-max"><i class='bx bx-user'></i> ${lead.vendedor_nombre}</span>` :
            `<span class="text-xs text-gray-500 font-medium">Sin asignar</span>`;

        // Sales status badges
        let sellerStatusBadge = '';
        if (lead.estado_vendedor === 'EN_SEGUIMIENTO') {
            sellerStatusBadge = '<span class="px-2 py-0.5 bg-sky-950/40 text-sky-400 border border-sky-900/40 rounded text-xs font-semibold">Seguimiento</span>';
        } else if (lead.estado_vendedor === 'CITA_AGENDADA') {
            sellerStatusBadge = '<span class="px-2 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 rounded text-xs font-semibold">Cita Agendada</span>';
        } else if (lead.estado_vendedor === 'ATENDIDO') {
            sellerStatusBadge = '<span class="px-2 py-0.5 bg-green-500 text-black rounded text-xs font-bold shadow-[0_0_8px_rgba(34,197,94,0.4)]">Atendido ✅</span>';
        } else if (lead.estado_vendedor === 'DESCARTADO') {
            sellerStatusBadge = '<span class="px-2 py-0.5 bg-red-950/40 text-red-400 border border-red-900/40 rounded text-xs font-semibold">Descartado</span>';
        } else {
            sellerStatusBadge = '<span class="text-xs text-gray-600">-</span>';
        }

        return `
            <tr class="hover:bg-[#1c2128] transition-colors ${alertClass}">
                <td class="py-3 px-4">
                    <div class="font-medium text-white flex items-center">${dot}${lead.nombre}</div>
                    <div class="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <i class='bx bxl-whatsapp'></i> ${formatPhoneForDisplay(lead.telefono)}
                        ${accountBadge}
                    </div>
                </td>
                <td class="py-3 px-4 text-gray-400 font-mono text-xs">${lead.cedula_desencriptada || 'N/A'}</td>
                <td class="py-3 px-4">
                    <div class="text-gray-300 max-w-xs truncate" title="${lead.ultimo_mensaje || ''}">${lead.ultimo_mensaje || '-'}</div>
                    <div class="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <i class='bx bx-time'></i> ${timeAgo} por <span class="${lead.ultimo_emisor === 'BOT' ? 'text-neon' : lead.ultimo_emisor === 'HUMANO' ? 'text-blue-400' : 'text-purple-400'}">${lead.ultimo_emisor}</span>
                    </div>
                    <div class="mt-1 flex gap-1 flex-wrap">
                        ${tagsHtml}
                    </div>
                </td>
                <td class="py-3 px-4">${assignedSeller}</td>
                <td class="py-3 px-4">${sellerStatusBadge}</td>
                <td class="py-3 px-4">${statusBadge}</td>
                <td class="py-3 px-4 text-right space-x-2">
                    ${lead.estado_atencion !== 'RESUELTO' ? `
                        <button onclick="markAsResolved(${lead.id})" class="p-1.5 text-gray-400 hover:text-green-400 transition-colors" title="Marcar Resuelto">
                            <i class='bx bx-check-circle text-lg'></i>
                        </button>
                    ` : ''}
                    <button onclick="openLeadControlModal(${lead.id})" class="p-1.5 text-gray-400 hover:text-neon transition-colors" title="Gestionar Cliente">
                        <i class='bx bx-message-square-edit text-lg'></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Actions
window.markAsResolved = async (id) => {
    try {
        const res = await fetch(`/api/leads/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado_atencion: 'RESUELTO' })
        });
        if (res.ok) fetchLeads();
    } catch (error) {
        console.error('Error marking resolved', error);
    }
};

window.openLeadControlModal = (leadId) => {
    const lead = currentLeads.find(l => l.id === leadId);
    if (!lead) return;

    currentLeadIdForMessage = leadId;
    currentEditingTags = lead.tags ? lead.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    modalLeadInfo.innerHTML = `Cliente: <span class="font-bold text-neon">${lead.nombre}</span> | Teléfono: <span class="text-white">${formatPhoneForDisplay(lead.telefono)}</span> | Cédula: <span class="text-neon font-mono">${lead.cedula_desencriptada || 'N/A'}</span>`;
    
    document.getElementById('modal-lead-status').value = lead.estado_atencion;
    document.getElementById('modal-lead-step').value = lead.step_estado;
    document.getElementById('modal-lead-vendedor').value = lead.vendedor_id || 'UNASSIGNED';
    document.getElementById('modal-lead-vendedor-status').value = lead.estado_vendedor || 'NINGUNO';
    manualMessageText.value = '';

    // Cargar indicador de cuenta
    const accountIndicator = document.getElementById('chat-account-indicator');
    if (accountIndicator) {
        accountIndicator.textContent = lead.cuenta || 'Principal';
        accountIndicator.className = 'px-1.5 py-0.5 rounded bg-neon/15 text-neon text-[10px] uppercase font-mono tracking-wider font-bold';
    }

    renderModalTags();
    
    // Cargar historial de chat y unirse a la sala de sockets
    loadChatHistory(leadId);
    if (socket) {
        socket.emit('join_lead_chat', leadId);
    }
    
    messageModal.classList.remove('hidden');
};

function renderModalTags() {
    const container = document.getElementById('modal-tags-container');
    if (currentEditingTags.length === 0) {
        container.innerHTML = '<span class="text-xs text-gray-500 pl-1">Sin etiquetas</span>';
        return;
    }
    container.innerHTML = currentEditingTags.map(tag => `
        <span class="inline-flex items-center gap-1 bg-[#1a56db]/20 text-[#3b82f6] border border-[#1a56db]/40 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            ${tag}
            <button onclick="removeTag('${tag}')" class="hover:text-red-400 transition-colors font-bold text-xs ml-0.5">×</button>
        </span>
    `).join('');
}

window.removeTag = (tagToRemove) => {
    currentEditingTags = currentEditingTags.filter(t => t !== tagToRemove);
    renderModalTags();
};

// Add tag button click and enter key listeners
const addTagBtn = document.getElementById('modal-add-tag-btn');
const newTagInput = document.getElementById('modal-new-tag-input');
const saveModalBtn = document.getElementById('save-modal-btn');
const deleteModalBtn = document.getElementById('delete-modal-btn');

if (addTagBtn && newTagInput) {
    const addTagFn = () => {
        const val = newTagInput.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
        if (val && !currentEditingTags.includes(val)) {
            currentEditingTags.push(val);
            renderModalTags();
        }
        newTagInput.value = '';
    };

    addTagBtn.addEventListener('click', addTagFn);
    newTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTagFn();
        }
    });
}

if (saveModalBtn) {
    saveModalBtn.addEventListener('click', async () => {
        if (!currentLeadIdForMessage) return;
        const estado_atencion = document.getElementById('modal-lead-status').value;
        const step_estado = parseInt(document.getElementById('modal-lead-step').value);
        const tags = currentEditingTags.join(',');
        const vendedor_id = document.getElementById('modal-lead-vendedor').value;
        const estado_vendedor = document.getElementById('modal-lead-vendedor-status').value;

        const ogText = saveModalBtn.innerHTML;
        saveModalBtn.innerHTML = `<div class="loader w-4.5 h-4.5 border-2"></div>`;
        saveModalBtn.disabled = true;

        try {
            const res = await fetch(`/api/leads/${currentLeadIdForMessage}/details`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    estado_atencion, 
                    step_estado, 
                    tags,
                    vendedor_id,
                    estado_vendedor
                })
            });

            if (res.ok) {
                closeModal();
                fetchLeads();
            } else {
                alert('Error al guardar los cambios');
            }
        } catch (error) {
            console.error('Error saving lead details', error);
            alert('Error al guardar los cambios');
        } finally {
            saveModalBtn.innerHTML = ogText;
            saveModalBtn.disabled = false;
        }
    });
}

if (deleteModalBtn) {
    deleteModalBtn.addEventListener('click', async () => {
        if (!currentLeadIdForMessage) return;
        if (!confirm('¿Estás seguro de que deseas eliminar permanentemente a este cliente? Esta acción no se puede deshacer.')) return;

        const ogText = deleteModalBtn.innerHTML;
        deleteModalBtn.innerHTML = `<div class="loader w-4.5 h-4.5 border-2"></div>`;
        deleteModalBtn.disabled = true;

        try {
            const res = await fetch(`/api/leads/${currentLeadIdForMessage}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                closeModal();
                fetchLeads();
            } else {
                alert('Error al eliminar el cliente');
            }
        } catch (error) {
            console.error('Error deleting lead', error);
            alert('Error al eliminar el cliente');
        } finally {
            deleteModalBtn.innerHTML = ogText;
            deleteModalBtn.disabled = false;
        }
    });
}

function closeModal() {
    if (currentLeadIdForMessage && socket) {
        socket.emit('leave_lead_chat', currentLeadIdForMessage);
    }
    messageModal.classList.add('hidden');
    currentLeadIdForMessage = null;
}

closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);

async function loadChatHistory(leadId) {
    const container = document.getElementById('chat-history-container');
    if (!container) return;
    
    container.innerHTML = '<div class="text-center text-gray-600 py-8">Cargando conversación...</div>';
    
    try {
        const res = await fetch(`/api/leads/${leadId}/messages`);
        const result = await res.json();
        if (res.ok && result.success) {
            renderChatHistory(result.data);
        } else {
            container.innerHTML = '<div class="text-center text-red-500 py-8">Error al cargar el historial</div>';
        }
    } catch (err) {
        console.error('Error loading chat history:', err);
        container.innerHTML = '<div class="text-center text-red-500 py-8">Error de red al cargar el chat</div>';
    }
}

function renderChatHistory(messages) {
    const container = document.getElementById('chat-history-container');
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8 font-medium">No hay mensajes previos en esta conversación</div>';
        return;
    }
    
    container.innerHTML = '';
    messages.forEach(msg => {
        appendMessageToContainer(msg);
    });
    
    scrollChatToBottom();
}

function appendMessageToContainer(msg) {
    const container = document.getElementById('chat-history-container');
    if (!container) return;
    
    // Quitar placeholder si existe
    const placeholder = container.querySelector('.text-center');
    if (placeholder) {
        placeholder.remove();
    }
    
    const div = document.createElement('div');
    const isHuman = msg.emisor === 'HUMANO';
    const isBot = msg.emisor === 'BOT';
    
    let alignClass = '';
    let bubbleClass = '';
    let badge = '';
    
    if (isHuman) {
        alignClass = 'self-end items-end';
        bubbleClass = 'bg-[#0d1e2e] border border-blue-900/60 text-white rounded-l-lg rounded-tr-lg';
        badge = '<span class="text-[9px] text-blue-400 font-bold block mb-0.5">👤 VENDEDOR</span>';
    } else if (isBot) {
        alignClass = 'self-start items-start';
        bubbleClass = 'bg-[#161b22] border border-gray-800 text-gray-300 rounded-r-lg rounded-tl-lg';
        badge = '<span class="text-[9px] text-gray-400 font-bold block mb-0.5">🤖 BOT</span>';
    } else {
        alignClass = 'self-start items-start';
        bubbleClass = 'bg-[#0d1f14] border border-green-900/60 text-white rounded-r-lg rounded-tl-lg';
        badge = '<span class="text-[9px] text-neon font-bold block mb-0.5">💬 CLIENTE</span>';
    }
    
    div.className = `flex flex-col max-w-[85%] ${alignClass}`;
    
    let timeStr = '';
    try {
        timeStr = dayjs(msg.fecha).format('h:mm A');
    } catch(e) {
        timeStr = '';
    }
    
    let contentHtml = `<div class="whitespace-pre-wrap break-words text-left">${escapeHTML(msg.texto)}</div>`;
    
    if (msg.tipo && msg.tipo !== 'text') {
        const fileIcon = msg.tipo === 'image' ? '🖼️' : msg.tipo === 'video' ? '🎬' : msg.tipo === 'audio' ? '🎵' : '📄';
        const fileLabel = msg.tipo === 'image' ? 'Descargar imagen' : msg.tipo === 'video' ? 'Descargar video' : msg.tipo === 'audio' ? 'Descargar audio' : 'Descargar archivo';
        const fileUrl = `/uploads/${msg.texto}`;
        
        contentHtml = `
            <div class="mb-2 text-sm break-words">
                <span class="mr-1">${fileIcon}</span> ${escapeHTML(msg.texto)}
            </div>
            <a href="${fileUrl}" target="_blank" download class="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1f2937] hover:bg-[#374151] border border-gray-600 rounded text-xs text-blue-400 font-medium transition-colors no-underline">
                <i class='bx bx-download'></i> ${fileLabel}
            </a>
        `;
    }

    div.innerHTML = `
        <div class="px-3 py-2 rounded-md ${bubbleClass}">
            ${badge}
            ${contentHtml}
            <span class="text-[9px] text-gray-500 block text-right mt-1">${timeStr}</span>
        </div>
    `;
    container.appendChild(div);
}

function scrollChatToBottom() {
    const container = document.getElementById('chat-history-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}


sendModalBtn.addEventListener('click', async () => {
    if (!currentLeadIdForMessage) return;
    const mensaje = manualMessageText.value.trim();
    if (!mensaje) return;

    const btnOgText = sendModalBtn.innerHTML;
    sendModalBtn.innerHTML = `<div class="loader w-4 h-4 border-2"></div>`;
    sendModalBtn.disabled = true;

    try {
        const res = await fetch(`/api/leads/${currentLeadIdForMessage}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensaje })
        });
        
        if (res.ok) {
            manualMessageText.value = '';
            fetchLeads(true);
        } else {
            const errData = await res.json().catch(() => ({}));
            alert(`Error al enviar el mensaje: ${errData.details || errData.error || 'Error del servidor'}`);
        }
    } catch (error) {
        console.error('Error sending message:', error);
        alert(`Error al enviar el mensaje: ${error.message || 'Error de red'}`);
    } finally {
        sendModalBtn.innerHTML = btnOgText;
        sendModalBtn.disabled = false;
        manualMessageText.focus();
    }
});

// Soporte Ctrl+Enter para enviar mensaje
manualMessageText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        sendModalBtn.click();
    }
});

refreshBtn.addEventListener('click', () => {
    const icon = refreshBtn.querySelector('i');
    icon.classList.add('bx-spin');
    fetchLeads().finally(() => icon.classList.remove('bx-spin'));
});

// Filters
filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Reset styles
        filterBtns.forEach(b => {
            b.classList.remove('bg-neon', 'text-black', 'font-medium', 'active-filter');
            b.classList.add('border', 'border-gray-700', 'text-gray-400');
        });
        // Set active
        const target = e.currentTarget;
        target.classList.remove('border', 'border-gray-700', 'text-gray-400');
        target.classList.add('bg-neon', 'text-black', 'font-medium', 'active-filter');
        
        activeFilter = target.getAttribute('data-status');
        fetchLeads();
    });
});

// Brands using robust event delegation
document.addEventListener('click', (e) => {
    const brandBtn = e.target.closest('.brand-btn');
    if (brandBtn) {
        // Reset styles
        document.querySelectorAll('.brand-btn').forEach(b => {
            b.classList.remove('bg-neon', 'text-black', 'font-medium', 'active-brand');
            b.classList.add('border', 'border-gray-700', 'text-gray-400');
        });
        // Set active
        brandBtn.classList.remove('border', 'border-gray-700', 'text-gray-400');

        const brand = brandBtn.getAttribute('data-brand');
        brandBtn.classList.add('bg-neon', 'text-black', 'font-medium', 'active-brand');
        
        activeBrand = brand;
        syncBotStatusUI(currentBotConfig);
        fetchLeads();
    }
});

// Bot Config Modal (Constructor de Bot) Handlers
const botConfigBtn = document.getElementById('bot-config-btn');
const botConfigModal = document.getElementById('bot-config-modal');
const closeBotModalBtn = document.getElementById('close-bot-modal-btn');
const cancelBotModalBtn = document.getElementById('cancel-bot-modal-btn');
const saveBotConfigBtn = document.getElementById('save-bot-config-btn');

async function openBotConfigModal() {
    const btnOg = botConfigBtn.innerHTML;
    botConfigBtn.innerHTML = `<div class="loader w-4 h-4 border-2"></div>`;
    botConfigBtn.disabled = true;

    try {
        const res = await fetch('/api/bot/flow');
        const data = await res.json();
        if (res.ok && data.success) {
            currentBotConfig = data.data;
            
            // Set Toggle state
            syncBotStatusUI(currentBotConfig);

            // Populate form fields defensively
            const linkPriv = document.getElementById('bot-link-privacidad');
            const linkApc = document.getElementById('bot-link-apc-bac');
            const startMsg = document.getElementById('bot-start-msg');
            const sopMsg = document.getElementById('bot-soporte-msg');
            const tafMsg = document.getElementById('bot-taffi-msg');
            const credMsg = document.getElementById('bot-crediya-msg');
            const bacMsg = document.getElementById('bot-bac-msg');
            const otroMsg = document.getElementById('bot-otro-msg');

            if (linkPriv) linkPriv.value = currentBotConfig.link_privacidad || '';
            if (linkApc) linkApc.value = currentBotConfig.link_apc_bac || '';
            if (startMsg) startMsg.value = currentBotConfig.menu_principal_mensaje || '';
            if (sopMsg) sopMsg.value = currentBotConfig.soporte_mensaje || '';
            if (tafMsg) tafMsg.value = currentBotConfig.taffi_mensaje || '';
            if (credMsg) credMsg.value = currentBotConfig.crediya_mensaje || '';
            if (bacMsg) bacMsg.value = currentBotConfig.bac_mensaje || '';
            if (otroMsg) otroMsg.value = currentBotConfig.otro_mensaje || '';

            // Show Modal
            botConfigModal.classList.remove('hidden');
        } else {
            alert('Error al obtener la configuración del bot');
        }
    } catch (error) {
        console.error('Error loading bot config', error);
        alert('Error al conectar con el servidor');
    } finally {
        botConfigBtn.innerHTML = btnOg;
        botConfigBtn.disabled = false;
    }
}

function closeBotConfigModal() {
    botConfigModal.classList.add('hidden');
}

async function saveBotConfig() {
    if (!currentBotConfig) return;

    const updatedConfig = {
        enabled: currentBotConfig.enabled !== false, // Keep general status enabled
        enabled_principal: document.getElementById('bot-enabled-principal')?.checked || false,
        link_privacidad: document.getElementById('bot-link-privacidad')?.value.trim() || '',
        link_apc_bac: document.getElementById('bot-link-apc-bac')?.value.trim() || '',
        menu_principal_mensaje: document.getElementById('bot-start-msg')?.value.trim() || '',
        soporte_mensaje: document.getElementById('bot-soporte-msg')?.value.trim() || '',
        taffi_mensaje: document.getElementById('bot-taffi-msg')?.value.trim() || '',
        crediya_mensaje: document.getElementById('bot-crediya-msg')?.value.trim() || '',
        bac_mensaje: document.getElementById('bot-bac-msg')?.value.trim() || '',
        otro_mensaje: document.getElementById('bot-otro-msg')?.value.trim() || ''
    };

    const btnOg = saveBotConfigBtn.innerHTML;
    saveBotConfigBtn.innerHTML = `<div class="loader w-4.5 h-4.5 border-2"></div> Guardando...`;
    saveBotConfigBtn.disabled = true;

    try {
        const res = await fetch('/api/bot/flow', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: updatedConfig })
        });

        if (res.ok) {
            closeBotConfigModal();
            currentBotConfig = updatedConfig;
            syncBotStatusUI(currentBotConfig);
            showToast('Constructor de Bot 🤖', '¡Configuración del flujo actualizada y aplicada en tiempo real! ✨', 'yellow');
        } else {
            alert('Error al guardar la configuración');
        }
    } catch (error) {
        console.error('Error saving bot config', error);
        alert('Error al conectar con el servidor');
    } finally {
        saveBotConfigBtn.innerHTML = btnOg;
        saveBotConfigBtn.disabled = false;
    }
}

// Bind Listeners
if (botConfigBtn) botConfigBtn.addEventListener('click', openBotConfigModal);
if (closeBotModalBtn) closeBotModalBtn.addEventListener('click', closeBotConfigModal);
if (cancelBotModalBtn) cancelBotModalBtn.addEventListener('click', closeBotConfigModal);
if (saveBotConfigBtn) saveBotConfigBtn.addEventListener('click', saveBotConfig);

// Header bot quick toggle listener
const headerBotToggleBtn = document.getElementById('header-bot-toggle');
if (headerBotToggleBtn) {
    headerBotToggleBtn.addEventListener('click', async () => {
        if (!currentBotConfig) {
            await fetchBotConfig();
        }
        if (!currentBotConfig) return;
        
        // Determinar qué estado alternar dependiendo de la cuenta activa
        let updatedConfig = { ...currentBotConfig };
        let msg = '';
        
        if (activeBrand === 'principal' || activeBrand === 'ALL') {
            const nextState = currentBotConfig.enabled_principal === false;
            updatedConfig.enabled_principal = nextState;
            msg = `¡Bot ${nextState ? 'ACTIVADO' : 'APAGADO'}!`;
        }
        
        // Show loading state in header button
        const indicator = document.getElementById('header-bot-indicator');
        const textSpan = document.getElementById('header-bot-toggle-text');
        if (indicator && textSpan) {
            indicator.innerHTML = `<div class="loader w-3.5 h-3.5 border-2 border-neon border-t-transparent animate-spin rounded-full"></div>`;
            textSpan.textContent = "Guardando...";
        }
        
        try {
            const res = await fetch('/api/bot/flow', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: updatedConfig })
            });
            
            if (res.ok) {
                currentBotConfig = updatedConfig;
                syncBotStatusUI(currentBotConfig);
                showToast('Bot Automático 🤖', msg, updatedConfig.enabled_principal ? 'yellow' : 'red');
            } else {
                alert('Error al guardar la configuración');
                syncBotStatusUI(currentBotConfig);
            }
        } catch (error) {
            console.error('Error toggling bot state:', error);
            alert('Error de conexión al cambiar el bot');
            syncBotStatusUI(currentBotConfig);
        }
    });
}

// ==========================================
// WHATSAPP CONNECTION STATUS MONITORING
// ==========================================
const whatsappStatusBtn = document.getElementById('whatsapp-status-btn');
const whatsappStatusModal = document.getElementById('whatsapp-status-modal');
const closeWhatsappModalBtn = document.getElementById('close-whatsapp-modal-btn');
const closeWhatsappModalFooter = document.getElementById('close-whatsapp-modal-footer');
const whatsappStatusContent = document.getElementById('whatsapp-status-content');

// Helper to translate statuses and get colors
function getWhatsAppStatusUIConfig(status) {
    switch (status) {
        case 'meta_connected':
            return { label: 'Meta API ⚡', colorClass: 'bg-indigo-950/60 text-indigo-400 border-indigo-500/40', dotClass: 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse' };
        case 'connected':
            return { label: 'Conectado ✅', colorClass: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40', dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' };
        case 'connecting':
            return { label: 'Conectando... ⏳', colorClass: 'bg-sky-950/60 text-sky-400 border-sky-500/40', dotClass: 'bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.6)]' };
        case 'qr_pending':
            return { label: 'Esperando QR 📲', colorClass: 'bg-amber-950/60 text-amber-400 border-amber-500/40', dotClass: 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]' };
        case 'disconnected':
        default:
            return { label: 'Desconectado ❌', colorClass: 'bg-red-950/60 text-red-400 border-red-500/40', dotClass: 'bg-red-500' };
    }
}

// Fetch WhatsApp connection status
async function fetchWhatsAppStatus(silent = false) {
    try {
        const res = await fetch('/api/whatsapp/status');
        if (!res.ok) return;
        const data = await res.json();
        
        data.forEach(account => {
            const uiConfig = getWhatsAppStatusUIConfig(account.status);
            
            // Update brand dots in the dashboard
            const dot = document.getElementById(`brand-status-${account.id}`);
            if (dot) {
                dot.className = `w-2.5 h-2.5 rounded-full transition-all duration-300 ${uiConfig.dotClass}`;
                dot.title = `WhatsApp: ${uiConfig.label}`;
            }
        });
        
        // If modal is open, render its detailed content
        if (whatsappStatusModal && !whatsappStatusModal.classList.contains('hidden')) {
            renderWhatsAppStatusModalContent(data);
        }
    } catch (err) {
        console.error('Error fetching WhatsApp connection status:', err);
    }
}

// Render dynamic modal content
function renderWhatsAppStatusModalContent(accounts) {
    if (!whatsappStatusContent) return;
    
    let html = '';
    accounts.forEach(account => {
        const uiConfig = getWhatsAppStatusUIConfig(account.status);
        
        let qrSection = '';
        if (account.status === 'qr_pending') {
            if (account.qr) {
                qrSection = `
                    <div class="mt-4 p-4 bg-[#010409] border border-gray-800 rounded-lg flex flex-col items-center">
                        <p class="text-xs text-gray-400 mb-3 text-center">Escanea este código QR con tu WhatsApp Business para conectar la cuenta:</p>
                        <img src="${account.qr}" class="w-56 h-56 rounded-lg bg-white p-2 shadow-2xl" alt="QR WhatsApp" />
                        <p class="text-[10px] text-gray-500 mt-2 text-center animate-pulse">Sincronizando... la pantalla se actualizará automáticamente.</p>
                    </div>
                `;
            } else {
                qrSection = `
                    <div class="mt-4 p-6 bg-[#010409] border border-gray-800 rounded-lg flex flex-col items-center justify-center">
                        <div class="loader w-8 h-8 border-2 border-neon border-t-transparent animate-spin rounded-full mb-3"></div>
                        <p class="text-xs text-gray-400">Generando código QR, por favor espera...</p>
                    </div>
                `;
            }
        }
        
        let actionButton = '';
        if (account.status === 'meta_connected') {
            actionButton = `
                <div class="flex justify-end mt-2 pt-3 border-t border-gray-800/50">
                    <p class="text-[10px] text-gray-500 italic text-right">Esta cuenta está conectada oficialmente mediante la API Cloud de Meta. La desvinculación o configuración se gestiona desde el panel de desarrolladores de Facebook.</p>
                </div>
            `;
        } else {
            actionButton = `
                <div class="flex justify-end mt-2 pt-3 border-t border-gray-800/50">
                    <button class="disconnect-wa-btn px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 text-red-400 text-xs font-bold rounded transition-colors flex items-center gap-1" data-account="${account.id}">
                        <i class='bx bx-unlink'></i> Desvincular y Generar nuevo QR
                    </button>
                </div>
            `;
        }
        
        html += `
            <div class="bg-[#161b22] border border-gray-800 rounded-xl p-5 flex flex-col gap-3 shadow-lg hover:border-gray-700 transition-all duration-300">
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
                            <i class='bx bxl-whatsapp text-xl text-neon'></i> WhatsApp ${account.label}
                        </h3>
                        <p class="text-[11px] text-gray-400">Línea del CRM para ${account.label}</p>
                    </div>
                    <span class="px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border shadow-md ${uiConfig.colorClass}">
                        ${uiConfig.label}
                    </span>
                </div>
                
                ${qrSection}
                
                ${actionButton}
            </div>
        `;
    });
    
    whatsappStatusContent.innerHTML = html;
}

// Trigger manual disconnect
async function disconnectWhatsAppAccount(accountId, btn) {
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<div class="loader w-3.5 h-3.5 border-2 border-red-400 border-t-transparent animate-spin rounded-full font-bold"></div> Desvinculando...`;
    
    try {
        const res = await fetch(`/api/whatsapp/disconnect/${accountId}`, { method: 'POST' });
        const data = await res.json();
        
        if (res.ok && data.success) {
            showToast('Línea WhatsApp 🔌', `¡Línea ${accountId.toUpperCase()} desvinculada! Generando código QR nuevo...`, 'red');
            await fetchWhatsAppStatus();
        } else {
            alert(`Error: ${data.error || 'No se pudo desvincular la cuenta'}`);
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    } catch (err) {
        console.error('Error disconnecting WhatsApp:', err);
        alert('Error al conectar con el servidor.');
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// Modal open/close controllers
function openWhatsAppStatusModal() {
    if (whatsappStatusModal) {
        whatsappStatusModal.classList.remove('hidden');
        whatsappStatusContent.innerHTML = '<div class="flex justify-center py-8"><div class="loader"></div></div>';
        fetchWhatsAppStatus();
        
        // Fast polling (every 3 seconds) while modal is open to capture QR scan success quickly
        if (waStatusModalInterval) clearInterval(waStatusModalInterval);
        waStatusModalInterval = setInterval(() => fetchWhatsAppStatus(true), 3000);
    }
}

function closeWhatsAppStatusModal() {
    if (whatsappStatusModal) {
        whatsappStatusModal.classList.add('hidden');
        if (waStatusModalInterval) {
            clearInterval(waStatusModalInterval);
            waStatusModalInterval = null;
        }
    }
}

// Bind Listeners
if (whatsappStatusBtn) whatsappStatusBtn.addEventListener('click', openWhatsAppStatusModal);
if (closeWhatsappModalBtn) closeWhatsappModalBtn.addEventListener('click', closeWhatsAppStatusModal);
if (closeWhatsappModalFooter) closeWhatsappModalFooter.addEventListener('click', closeWhatsAppStatusModal);

// Modal content event delegation for disconnect buttons
if (whatsappStatusContent) {
    whatsappStatusContent.addEventListener('click', (e) => {
        const btn = e.target.closest('.disconnect-wa-btn');
        if (btn) {
            const accountId = btn.getAttribute('data-account');
            if (confirm(`¿Estás seguro de que deseas desvincular la línea ${accountId.toUpperCase()}? Esto cerrará la sesión actual en el teléfono y tendrás que escanear un nuevo código QR.`)) {
                disconnectWhatsAppAccount(accountId, btn);
            }
        }
    });
}

// ==========================================
// SELLER MANAGEMENT & SEARCH BINDINGS
// ==========================================
async function fetchSellers() {
    try {
        const res = await fetch('/api/sellers');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
            allSellers = data.data;
            populateSellersDropdowns();
            renderSellersList();
        }
    } catch (err) {
        console.error('Error fetching sellers:', err);
    }
}

let monthlyGoals = [];

async function fetchSellersGoals() {
    if (userRole === 'content_manager') return;
    try {
        const res = await fetch('/api/sellers/goals');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
            monthlyGoals = data.data;
            renderSellersGoals();
        }
    } catch (err) {
        console.error('Error fetching sellers goals:', err);
    }
}

function renderSellersGoals() {
    const goalsPanel = document.getElementById('goals-panel');
    const goalsContainer = document.getElementById('goals-container');
    if (!goalsPanel || !goalsContainer) return;

    if (!monthlyGoals || monthlyGoals.length === 0) {
        goalsPanel.classList.add('hidden');
        return;
    }

    goalsPanel.classList.remove('hidden');

    goalsContainer.innerHTML = monthlyGoals.map(seller => {
        const target = 10;
        const count = parseInt(seller.sold_count, 10) || 0;
        const percentage = Math.min(100, Math.round((count / target) * 100));

        // Determine semaphore colors (Red: 0-3, Yellow: 4-7, Green: 8-10+)
        let semaphoreColor = 'bg-red-500';
        let badgeColor = 'bg-red-950/40 text-red-400 border-red-900/40';
        let glowShadow = 'shadow-[0_0_8px_rgba(239,68,68,0.4)]';
        let textStatus = 'Alerta 🔴';

        if (count >= 4 && count <= 7) {
            semaphoreColor = 'bg-amber-500';
            badgeColor = 'bg-amber-950/40 text-amber-400 border-amber-900/40';
            glowShadow = 'shadow-[0_0_8px_rgba(245,158,11,0.4)]';
            textStatus = 'En Camino 🟡';
        } else if (count >= 8) {
            semaphoreColor = 'bg-emerald-500';
            badgeColor = 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40';
            glowShadow = 'shadow-[0_0_12px_rgba(16,185,129,0.6)]';
            textStatus = count >= target ? 'Cumplido 🎉🟢' : 'Por cumplir 🟢';
        }

        // Render card
        return `
            <div class="bg-[#161b22] border border-gray-800 rounded-xl p-4 flex flex-col gap-2.5 shadow-md hover:border-gray-700 hover:shadow-lg transition-all duration-300">
                <div class="flex justify-between items-center gap-2">
                    <span class="text-xs font-bold text-white truncate" title="${seller.vendedor_nombre}">
                        👤 ${seller.vendedor_nombre}
                    </span>
                    <span class="px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${badgeColor}">
                        ${textStatus}
                    </span>
                </div>
                
                <div class="flex justify-between items-end text-[10px] text-gray-400 mt-1">
                    <span>Ventas del mes</span>
                    <span class="font-medium text-white"><strong class="text-neon text-xs">${count}</strong> / ${target}</span>
                </div>

                <div class="w-full bg-[#010409] h-2 rounded-full overflow-hidden border border-gray-800">
                    <div class="h-full rounded-full transition-all duration-500 ${semaphoreColor} ${glowShadow}" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ==============================================================
// KPIs Mensuales de Negocio (CAC, ROAS, Meta 30 Créditos)
// Visible para TODOS los usuarios (Vendedores, CM y Admin)
// ==============================================================
let currentMonthlyBusinessKpis = null;

async function fetchMonthlyBusinessKpis() {
    try {
        const res = await fetch('/api/kpis/monthly');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) {
            currentMonthlyBusinessKpis = data;
            renderMonthlyBusinessKpis(data);
        }
    } catch (err) {
        console.error('Error fetching monthly business KPIs:', err);
    }
}

function renderMonthlyBusinessKpis(kpis) {
    if (!kpis) return;

    // 1. Panel Principal en CRM (crm-main-view)
    const monthBadge = document.getElementById('business-kpi-month-badge');
    if (monthBadge && kpis.monthName) monthBadge.innerText = kpis.monthName;

    const salesTotalEl = document.getElementById('business-kpi-sales-total');
    const salesTargetEl = document.getElementById('business-kpi-sales-target');
    const salesPctEl = document.getElementById('business-kpi-sales-pct');
    const salesCrmEl = document.getElementById('business-kpi-sales-crm');
    const salesManualEl = document.getElementById('business-kpi-sales-manual');
    const salesBarEl = document.getElementById('business-kpi-sales-bar');
    const salesBadgeEl = document.getElementById('business-kpi-sales-badge');

    const totalSold = parseInt(kpis.totalSoldCredits, 10) || 0;
    const target = parseInt(kpis.targetCredits, 10) || 30;
    const pct = target > 0 ? Math.min(100, Math.round((totalSold / target) * 100)) : 0;

    if (salesTotalEl) salesTotalEl.innerText = totalSold;
    if (salesTargetEl) salesTargetEl.innerText = target;
    if (salesPctEl) salesPctEl.innerText = `${pct}%`;
    if (salesCrmEl) salesCrmEl.innerText = kpis.crmSoldCredits || 0;
    if (salesManualEl) salesManualEl.innerText = kpis.manualCredits || 0;

    // Semáforo de colores para la Meta Global de Ventas (30 Créditos)
    let barColor = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]';
    let badgeClass = 'px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider bg-red-950/40 text-red-400 border-red-900/40';
    let badgeText = 'Alerta 🔴';

    if (totalSold >= 12 && totalSold < 25) {
        barColor = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
        badgeClass = 'px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider bg-amber-950/40 text-amber-400 border-amber-900/40';
        badgeText = 'En Camino 🟡';
    } else if (totalSold >= 25 && totalSold < target) {
        barColor = 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
        badgeClass = 'px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider bg-emerald-950/40 text-emerald-400 border-emerald-500/40';
        badgeText = 'Por Cumplir 🟢';
    } else if (totalSold >= target) {
        barColor = 'bg-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.7)] animate-pulse';
        badgeClass = 'px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider bg-emerald-900 text-emerald-200 border-emerald-400 shadow-sm';
        badgeText = '¡Meta Cumplida! 🎉🟢';
    }

    if (salesBarEl) {
        salesBarEl.className = `h-full rounded-full transition-all duration-500 ${barColor}`;
        salesBarEl.style.width = `${pct}%`;
    }
    if (salesBadgeEl) {
        salesBadgeEl.className = badgeClass;
        salesBadgeEl.innerText = badgeText;
    }

    // CAC & ROAS
    const cacEl = document.getElementById('business-kpi-cac-value');
    if (cacEl) {
        const cacVal = Number(kpis.cac) || 0;
        cacEl.innerText = `$${cacVal.toFixed(2)}`;
    }

    const roasEl = document.getElementById('business-kpi-roas-value');
    if (roasEl) {
        const roasVal = Number(kpis.roas) || 0;
        roasEl.innerText = `${roasVal.toFixed(2)}x`;
    }

    // KPI 4: Ingresos Ventas del Interior vs Ciudad
    const formatUSD = num => '$' + Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const revTotalEl = document.getElementById('business-kpi-revenue-total');
    const revIntEl = document.getElementById('business-kpi-revenue-interior');
    const revCdEl = document.getElementById('business-kpi-revenue-ciudad');
    const pctIntEl = document.getElementById('business-kpi-pct-interior');
    const pctCdEl = document.getElementById('business-kpi-pct-ciudad');
    const barIntEl = document.getElementById('business-kpi-bar-interior');
    const barCdEl = document.getElementById('business-kpi-bar-ciudad');

    const totalRev = Number(kpis.totalRevenue) || 0;
    const revInt = Number(kpis.revenueInterior) || 0;
    const revCd = Number(kpis.revenueCiudad) || 0;
    const pctInt = totalRev > 0 ? (kpis.pctInterior || 0) : 0;
    const pctCd = totalRev > 0 ? (kpis.pctCiudad || 0) : 0;

    if (revTotalEl) revTotalEl.innerText = formatUSD(totalRev);
    if (revIntEl) revIntEl.innerText = formatUSD(revInt);
    if (revCdEl) revCdEl.innerText = formatUSD(revCd);
    if (pctIntEl) pctIntEl.innerText = `${pctInt}%` + (kpis.countInterior ? ` (${kpis.countInterior} vtas)` : '');
    if (pctCdEl) pctCdEl.innerText = `${pctCd}%` + (kpis.countCiudad ? ` (${kpis.countCiudad} vtas)` : '');

    if (barIntEl && barCdEl) {
        if (totalRev > 0) {
            barIntEl.style.width = `${pctInt}%`;
            barCdEl.style.width = `${pctCd}%`;
        } else {
            barIntEl.style.width = '50%';
            barCdEl.style.width = '50%';
        }
    }

    // Botón de ajuste para Admin
    const adminEditContainer = document.getElementById('admin-kpi-edit-btn-container');
    if (adminEditContainer) {
        if (kpis.isAdmin || userRole === 'admin') {
            adminEditContainer.classList.remove('hidden');
        } else {
            adminEditContainer.classList.add('hidden');
        }
    }

    // 2. Fila Complementaria en Parrilla de Contenido
    const parrillaSoldEl = document.getElementById('parrilla-kpi-credits-sold');
    const parrillaTargetEl = document.getElementById('parrilla-kpi-credits-target');
    const parrillaPctEl = document.getElementById('parrilla-kpi-credits-pct');
    const parrillaCacEl = document.getElementById('parrilla-kpi-cac-val');
    const parrillaRoasEl = document.getElementById('parrilla-kpi-roas-val');
    const parrillaGeoRatioEl = document.getElementById('parrilla-kpi-geo-ratio');
    const parrillaGeoTotalEl = document.getElementById('parrilla-kpi-geo-total');

    if (parrillaSoldEl) parrillaSoldEl.innerText = totalSold;
    if (parrillaTargetEl) parrillaTargetEl.innerText = target;
    if (parrillaPctEl) parrillaPctEl.innerText = `${pct}%`;
    if (parrillaCacEl) parrillaCacEl.innerText = `$${(Number(kpis.cac) || 0).toFixed(2)}`;
    if (parrillaRoasEl) parrillaRoasEl.innerText = `${(Number(kpis.roas) || 0).toFixed(2)}x`;
    if (parrillaGeoRatioEl) parrillaGeoRatioEl.innerText = `${pctInt}% Int / ${pctCd}% Cdad`;
    if (parrillaGeoTotalEl) parrillaGeoTotalEl.innerText = formatUSD(totalRev);
}

function openMonthlyKpisModal() {
    const modal = document.getElementById('monthly-kpis-modal');
    if (!modal) return;

    if (currentMonthlyBusinessKpis) {
        const monthLabel = document.getElementById('modal-kpi-month-label');
        if (monthLabel) monthLabel.innerText = currentMonthlyBusinessKpis.monthName || '';

        const cacInput = document.getElementById('input-kpi-cac');
        if (cacInput) cacInput.value = currentMonthlyBusinessKpis.cac !== undefined ? currentMonthlyBusinessKpis.cac : 0;

        const roasInput = document.getElementById('input-kpi-roas');
        if (roasInput) roasInput.value = currentMonthlyBusinessKpis.roas !== undefined ? currentMonthlyBusinessKpis.roas : 0;

        const targetInput = document.getElementById('input-kpi-target-credits');
        if (targetInput) targetInput.value = currentMonthlyBusinessKpis.targetCredits || 30;

        const manualInput = document.getElementById('input-kpi-manual-credits');
        if (manualInput) manualInput.value = currentMonthlyBusinessKpis.manualCredits || 0;

        const revCdInput = document.getElementById('input-kpi-revenue-ciudad');
        if (revCdInput) revCdInput.value = currentMonthlyBusinessKpis.revenueCiudad !== undefined ? currentMonthlyBusinessKpis.revenueCiudad : 0;

        const revIntInput = document.getElementById('input-kpi-revenue-interior');
        if (revIntInput) revIntInput.value = currentMonthlyBusinessKpis.revenueInterior !== undefined ? currentMonthlyBusinessKpis.revenueInterior : 0;
    }

    modal.classList.remove('hidden');
}

function closeMonthlyKpisModal() {
    const modal = document.getElementById('monthly-kpis-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveMonthlyBusinessKpis(event) {
    if (event) event.preventDefault();

    const cac = parseFloat(document.getElementById('input-kpi-cac')?.value) || 0;
    const roas = parseFloat(document.getElementById('input-kpi-roas')?.value) || 0;
    const targetCredits = parseInt(document.getElementById('input-kpi-target-credits')?.value, 10) || 30;
    const manualCredits = parseInt(document.getElementById('input-kpi-manual-credits')?.value, 10) || 0;
    const revenueCiudad = parseFloat(document.getElementById('input-kpi-revenue-ciudad')?.value) || 0;
    const revenueInterior = parseFloat(document.getElementById('input-kpi-revenue-interior')?.value) || 0;

    const saveBtn = document.getElementById('save-monthly-kpis-btn');
    const originalText = saveBtn ? saveBtn.innerHTML : 'Guardar';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<div class="loader w-3.5 h-3.5 border-2"></div> Guardando...`;
    }

    try {
        const res = await fetch('/api/kpis/monthly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cac, roas, targetCredits, manualCredits, revenueCiudad, revenueInterior })
        });
        const data = await res.json();
        if (data.success) {
            closeMonthlyKpisModal();
            await fetchMonthlyBusinessKpis();
            if (typeof showToast === 'function') {
                showToast('KPIs Mensuales 🎯', 'Objetivos comerciales y métricas actualizados con éxito', 'green');
            }
        } else {
            alert('Error al guardar KPIs: ' + (data.error || 'Desconocido'));
        }
    } catch (err) {
        console.error('Error saving monthly KPIs:', err);
        alert('Error de conexión al actualizar KPIs.');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }
}

window.fetchMonthlyBusinessKpis = fetchMonthlyBusinessKpis;
window.renderMonthlyBusinessKpis = renderMonthlyBusinessKpis;
window.openMonthlyKpisModal = openMonthlyKpisModal;
window.closeMonthlyKpisModal = closeMonthlyKpisModal;
window.saveMonthlyBusinessKpis = saveMonthlyBusinessKpis;

function populateSellersDropdowns() {
    const filterSelect = document.getElementById('filter-vendedor');
    const modalSelect = document.getElementById('modal-lead-vendedor');
    
    if (filterSelect) {
        filterSelect.innerHTML = `
            <option value="ALL">Todos los vendedores</option>
            <option value="UNASSIGNED">Sin asignar</option>
            ${allSellers.map(s => `<option value="${s.id}">${s.username}</option>`).join('')}
        `;
        filterSelect.value = activeVendedorFilter;
    }
    
    if (modalSelect) {
        modalSelect.innerHTML = `
            <option value="UNASSIGNED">Sin asignar</option>
            ${allSellers.map(s => `<option value="${s.id}">${s.username}</option>`).join('')}
        `;
    }
}

function renderSellersList() {
    const body = document.getElementById('sellers-list-body');
    if (!body) return;
    
    const nonAdmins = allSellers.filter(s => s.role !== 'admin');
    if (nonAdmins.length === 0) {
        body.innerHTML = `<tr><td colspan="2" class="py-4 text-center text-gray-500">No hay vendedores creados</td></tr>`;
        return;
    }
    
    body.innerHTML = nonAdmins.map(s => `
        <tr class="hover:bg-[#1c2128] border-b border-gray-800">
            <td class="py-2.5 px-3 font-medium text-white">${s.username} ${s.role === 'content_manager' ? '<span class="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/50 ml-1">CM</span>' : '<span class="text-[10px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded ml-1">Vendedor</span>'}</td>
            <td class="py-2.5 px-3 text-right">
                <button type="button" onclick="deleteSellerAccount(${s.id})" class="text-red-400 hover:text-red-300 font-bold transition-colors">
                    <i class='bx bx-trash text-sm'></i> Eliminar
                </button>
            </td>
        </tr>
    `).join('');
}

window.deleteSellerAccount = async (id) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este vendedor?')) return;
    try {
        const res = await fetch(`/api/sellers/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast('Vendedor eliminado 👤', 'La cuenta ha sido eliminada con éxito.', 'red');
            fetchSellers();
            fetchLeads(true);
        } else {
            alert(data.error || 'Error al eliminar el vendedor');
        }
    } catch (err) {
        console.error('Error deleting seller:', err);
    }
};

window.addQuickTag = (tag) => {
    const cleanTag = tag.toUpperCase().trim();
    if (cleanTag && !currentEditingTags.includes(cleanTag)) {
        currentEditingTags.push(cleanTag);
        renderModalTags();
    }
};

const addSellerForm = document.getElementById('add-seller-form');
if (addSellerForm) {
    addSellerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('seller-username').value;
        const password = document.getElementById('seller-password').value;
        const role = document.getElementById('seller-role') ? document.getElementById('seller-role').value : 'vendedor';
        
        try {
            const res = await fetch('/api/sellers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Vendedor agregado 👤', `¡Cuenta para ${username} creada con éxito!`, 'yellow');
                addSellerForm.reset();
                fetchSellers();
            } else {
                alert(data.error || 'Error al agregar el vendedor');
            }
        } catch (err) {
            console.error('Error adding seller:', err);
        }
    });
}

// Bind Sellers Modal open/close
const manageSellersBtn = document.getElementById('manage-sellers-btn');
const sellersModal = document.getElementById('sellers-modal');
const closeSellersModalBtn = document.getElementById('close-sellers-modal-btn');
const closeSellersModalFooter = document.getElementById('close-sellers-modal-footer');

function openSellersModal() {
    if (sellersModal) {
        sellersModal.classList.remove('hidden');
        fetchSellers();
    }
}

function closeSellersModal() {
    if (sellersModal) {
        sellersModal.classList.add('hidden');
    }
}

if (manageSellersBtn) manageSellersBtn.addEventListener('click', openSellersModal);
if (closeSellersModalBtn) closeSellersModalBtn.addEventListener('click', closeSellersModal);
if (closeSellersModalFooter) closeSellersModalFooter.addEventListener('click', closeSellersModal);

// Advanced Filter Bindings
const searchInput = document.getElementById('search-input');
const filterVendedor = document.getElementById('filter-vendedor');
const filterVendedorStatus = document.getElementById('filter-vendedor-status');
const filterStartDate = document.getElementById('filter-start-date');
const filterEndDate = document.getElementById('filter-end-date');
const myClientsBtn = document.getElementById('my-clients-btn');

let searchDebounceTimeout;
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
            currentSearchQuery = e.target.value.trim();
            fetchLeads();
        }, 400);
    });
}

if (filterVendedor) {
    filterVendedor.addEventListener('change', (e) => {
        activeVendedorFilter = e.target.value;
        fetchLeads();
    });
}

if (filterVendedorStatus) {
    filterVendedorStatus.addEventListener('change', (e) => {
        activeVendedorStatusFilter = e.target.value;
        fetchLeads();
    });
}

if (filterStartDate) {
    filterStartDate.addEventListener('change', (e) => {
        activeStartDate = e.target.value;
        fetchLeads();
    });
}

if (filterEndDate) {
    filterEndDate.addEventListener('change', (e) => {
        activeEndDate = e.target.value;
        fetchLeads();
    });
}

if (myClientsBtn) {
    myClientsBtn.addEventListener('click', () => {
        onlyMyLeads = !onlyMyLeads;
        if (onlyMyLeads) {
            myClientsBtn.className = "px-5 py-2 rounded-lg text-sm bg-neon text-black font-medium flex items-center gap-2";
        } else {
            myClientsBtn.className = "border border-gray-700 text-gray-400 hover:border-neon hover:text-neon px-5 py-2 rounded-lg text-sm transition-all duration-300 flex items-center gap-2";
        }
        fetchLeads();
    });
}
