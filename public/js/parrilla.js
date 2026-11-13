document.addEventListener('DOMContentLoaded', () => {
    const parrillaBtn = document.getElementById('parrilla-btn');
    const crmMainView = document.getElementById('crm-main-view');
    const parrillaView = document.getElementById('parrilla-view');
    const myClientsBtn = document.getElementById('my-clients-btn');
    const brandBtns = document.querySelectorAll('.brand-btn');
    
    const viewKanbanBtn = document.getElementById('view-kanban-btn');
    const viewCalendarBtn = document.getElementById('view-calendar-btn');
    const kanbanBoard = document.getElementById('kanban-board');
    const calendarBoard = document.getElementById('calendar-board');
    let calendar; // FullCalendar instance
    function showParrilla() {
        crmMainView.classList.add('hidden');
        parrillaView.classList.remove('hidden');
        parrillaView.classList.add('flex');
        loadCards();
        loadUsers();
        if (typeof window.fetchMonthlyBusinessKpis === 'function') {
            window.fetchMonthlyBusinessKpis();
        }
    }
    
    function showCRM() {
        parrillaView.classList.add('hidden');
        parrillaView.classList.remove('flex');
        crmMainView.classList.remove('hidden');
    }
    
    if (parrillaBtn) parrillaBtn.addEventListener('click', () => {
        showParrilla();
        if (calendar) calendar.render();
    });
    if (myClientsBtn) myClientsBtn.addEventListener('click', showCRM);
    brandBtns.forEach(btn => btn.addEventListener('click', showCRM));

    // Tablero vs Calendario Toggles
    if (viewKanbanBtn) viewKanbanBtn.addEventListener('click', () => {
        kanbanBoard.classList.remove('hidden');
        kanbanBoard.classList.add('flex');
        calendarBoard.classList.add('hidden');
        viewKanbanBtn.classList.replace('text-gray-400', 'text-white');
        viewKanbanBtn.classList.add('bg-gray-800');
        viewCalendarBtn.classList.replace('text-white', 'text-gray-400');
        viewCalendarBtn.classList.remove('bg-gray-800');
    });

    if (viewCalendarBtn) viewCalendarBtn.addEventListener('click', () => {
        kanbanBoard.classList.add('hidden');
        kanbanBoard.classList.remove('flex');
        calendarBoard.classList.remove('hidden');
        viewCalendarBtn.classList.replace('text-gray-400', 'text-white');
        viewCalendarBtn.classList.add('bg-gray-800');
        viewKanbanBtn.classList.replace('text-white', 'text-gray-400');
        viewKanbanBtn.classList.remove('bg-gray-800');
        if (calendar) calendar.render();
    });

    // Mouse Drag-to-Scroll (Pan) & Shift/Wheel scroll on Kanban Board
    if (kanbanBoard) {
        let isDown = false;
        let startX;
        let scrollLeft;

        kanbanBoard.addEventListener('mousedown', (e) => {
            // No activar pan si se hace clic sobre una tarjeta, botón, enlace o input
            if (e.target.closest('.kanban-cards > div') || e.target.closest('button') || e.target.closest('a') || e.target.closest('input') || e.target.closest('select')) return;
            isDown = true;
            kanbanBoard.classList.add('cursor-grabbing');
            startX = e.pageX - kanbanBoard.offsetLeft;
            scrollLeft = kanbanBoard.scrollLeft;
        });

        kanbanBoard.addEventListener('mouseleave', () => {
            isDown = false;
            kanbanBoard.classList.remove('cursor-grabbing');
        });

        kanbanBoard.addEventListener('mouseup', () => {
            isDown = false;
            kanbanBoard.classList.remove('cursor-grabbing');
        });

        kanbanBoard.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - kanbanBoard.offsetLeft;
            const walk = (x - startX) * 1.5; // multiplicador de velocidad
            kanbanBoard.scrollLeft = scrollLeft - walk;
        });
    }

    // Helper para desplazar horizontalmente con botones de dirección
    window.scrollKanbanDirection = function(amount) {
        if (kanbanBoard) {
            kanbanBoard.scrollBy({ left: amount, behavior: 'smooth' });
        }
    };

    // Init Flatpickr
    flatpickr("#card-date", {
        enableTime: true,
        dateFormat: "d-m-Y H:i",
        time_24hr: false,
        locale: "es"
    });

    // Init FullCalendar
    const calendarEl = document.getElementById('calendar-board');
    if (calendarEl && typeof FullCalendar !== 'undefined') {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'es',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            themeSystem: 'standard',
            events: [],
            eventContent: function(arg) {
                // Hito del sistema: Día 15 Entrega Obligatoria de Calendario
                if (arg.event.extendedProps.isSystemDeadline) {
                    return {
                        html: `<div class="bg-gradient-to-r from-red-800 to-rose-700 text-white font-extrabold text-[10px] p-2 rounded-lg border-2 border-yellow-300 shadow-xl flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] transition-transform">
                            <i class='bx bxs-bell-ring text-yellow-300 text-sm animate-bounce'></i>
                            <div class="leading-tight">
                                <div class="text-[9px] uppercase tracking-wider text-yellow-200 font-mono">HITO OBLIGATORIO</div>
                                <div class="text-white font-bold text-[10px]">${arg.event.title}</div>
                            </div>
                        </div>`
                    };
                }

                // Fechas especiales Panamá / Tech / Gaming / Black Friday
                if (arg.event.extendedProps.isSpecialDate) {
                    const cat = arg.event.extendedProps.category;
                    let badgeBg = 'bg-[#1e1b4b] border-indigo-500/60 text-indigo-200';
                    if (cat === 'black_friday') {
                        badgeBg = 'bg-gradient-to-r from-red-950 to-orange-950 border-orange-500 text-yellow-300';
                    } else if (cat === 'gamer') {
                        badgeBg = 'bg-[#0f172a] border-cyan-500 text-cyan-300';
                    } else if (cat === 'feriado') {
                        badgeBg = 'bg-[#14291f] border-emerald-500 text-emerald-200';
                    } else if (cat === 'comercial') {
                        badgeBg = 'bg-[#2e1065] border-purple-500 text-purple-200';
                    }

                    return {
                        html: `<div class="${badgeBg} font-semibold text-[10px] p-1.5 rounded-lg border shadow-md flex items-center gap-1.5 cursor-pointer hover:scale-[1.02] hover:brightness-110 transition-all">
                            <span class="text-xs shrink-0">${arg.event.extendedProps.icon || '⭐'}</span>
                            <div class="truncate leading-tight">
                                <div class="font-bold truncate text-[10px]">${arg.event.title}</div>
                            </div>
                        </div>`
                    };
                }

                let html = `<div class="flex flex-col gap-1 p-2 w-full overflow-hidden text-xs rounded-lg bg-[#161b22] border border-gray-800 hover:border-purple-500/50 cursor-pointer shadow-md transition-all">`;
                if (arg.event.extendedProps.cover_image_url) {
                    html += `<div class="w-full h-12 bg-black rounded overflow-hidden flex items-center justify-center mb-1"><img src="${arg.event.extendedProps.cover_image_url}" class="w-full h-full object-cover"></div>`;
                }
                
                let pIcon = '';
                const p = arg.event.extendedProps.priority;
                if (p === 'Urgente') pIcon = '🔥 ';
                else if (p === 'Alta') pIcon = '⚡ ';
                else if (p === 'En Desarrollo') pIcon = '⚙️ ';
                else if (p === 'En Espera') pIcon = '⏳ ';
                else if (p === 'Listo') pIcon = '✅ ';

                html += `<div class="font-extrabold text-white truncate w-full text-[11px] leading-snug" title="${arg.event.title}">${pIcon}${arg.event.title}</div>`;
                
                // BADGE DESTACADO DE FASE / PASO ACTUAL (Requerimiento visual del usuario)
                const currentStatus = arg.event.extendedProps.status || 'Marca';
                const statusStyles = {
                    'Marca': 'bg-indigo-950 text-indigo-300 border-indigo-700',
                    'Ideas de Contenido': 'bg-yellow-950 text-yellow-300 border-yellow-700',
                    'Redactar Guión-Copy': 'bg-amber-950 text-amber-300 border-amber-700',
                    'Diseñar': 'bg-pink-950 text-pink-300 border-pink-700',
                    'Filmar': 'bg-rose-950 text-rose-300 border-rose-700',
                    'Editar': 'bg-cyan-950 text-cyan-300 border-cyan-700',
                    'Revisión': 'bg-purple-950 text-purple-300 border-purple-600',
                    'Recordatorio': 'bg-emerald-950 text-emerald-300 border-emerald-700',
                    'Contenido Extra (Jess)': 'bg-orange-950 text-orange-300 border-orange-600'
                };
                const badgeStyle = statusStyles[currentStatus] || 'bg-gray-800 text-gray-300 border-gray-700';

                html += `<div class="flex items-center gap-1">
                    <span class="text-[9px] px-1.5 py-0.5 rounded font-bold border ${badgeStyle} flex items-center gap-1 shadow-sm">
                        <span>Paso:</span> <strong>${currentStatus}</strong>
                    </span>
                </div>`;

                // Etiquetas de Redes Sociales con color oficial (IG, TikTok, FB, YT)
                const socialBadgesHtml = getSocialNetworksBadgesHtml(arg.event.extendedProps.social_networks, false);
                if (socialBadgesHtml) {
                    html += `<div class="flex flex-wrap items-center gap-1 my-1">${socialBadgesHtml}</div>`;
                }
                
                let subBadges = '';
                if (arg.event.extendedProps.assigned_to) {
                    subBadges += `<span class="bg-purple-900/60 text-neon text-[9px] px-1.5 py-0.5 rounded font-bold border border-purple-700/60">👤 ${arg.event.extendedProps.assigned_to}</span>`;
                }
                if (arg.event.extendedProps.tags) {
                    subBadges += `<span class="bg-gray-800 text-gray-300 text-[9px] px-1.5 py-0.5 rounded truncate border border-gray-700/60">${arg.event.extendedProps.tags}</span>`;
                }
                if (subBadges) html += `<div class="flex flex-wrap mt-0.5 gap-1">${subBadges}</div>`;
                html += `</div>`;
                return { html: html };
            },
            eventClick: function(info) {
                if (info.event.extendedProps.isSystemDeadline) {
                    alert('🚨 AVISO DE CONTROL (ADMIN):\n\nEl día 15 de cada mes es la fecha límite obligatoria para que la Community Manager (CM) entregue la planificación y parrilla de contenidos aprobada para el mes siguiente.');
                    return;
                }
                if (info.event.extendedProps.isSpecialDate) {
                    const title = info.event.title;
                    const dateStr = info.event.startStr;
                    const rec = info.event.extendedProps.recommendation || '';
                    const icon = info.event.extendedProps.icon || '⭐';

                    const promptMsg = `${icon} ${title.toUpperCase()}\nFecha: ${dateStr}\n\n💡 RECOMENDACIÓN PARA @ecosystems_celular:\n${rec}\n\n¿Deseas programar una nueva publicación para esta fecha especial ahora?`;
                    if (confirm(promptMsg)) {
                        openSpecialDateModal(title, dateStr, rec);
                    }
                    return;
                }
                const card = allCards.find(c => c.id == info.event.id);
                if (card) editCard(card);
            }
        });
        calendar.render();
    }

    // Modal elements
    const modal = document.getElementById('parrilla-modal');
    const closeBtn = document.getElementById('close-parrilla-modal-btn');
    const addCardBtn = document.getElementById('add-card-btn');
    const form = document.getElementById('parrilla-form');
    const deleteBtn = document.getElementById('delete-card-btn');
    const sendAlertBtn = document.getElementById('send-alert-card-btn');
    const modalTitle = document.getElementById('parrilla-modal-title');
    
    let allCards = [];

    const defaultCopyTemplate = `Día: 
Hora: 
RRSS: 
Formato: 
Pilar de contenido: 
Objetivo: 
Título: 
Narrativa: 
Caption:
Task: 
Estado:

Guion:

Escena 1: 

Voz: 

Escena 2: 

Voz: 

Copy:
`;

    // Configuración y gestión de Redes Sociales (Instagram, TikTok, Facebook, YouTube)
    const NETWORK_STYLES = {
        'Instagram': {
            active: 'bg-gradient-to-r from-purple-600/40 via-pink-600/40 to-rose-600/40 border-pink-500 text-white shadow-md shadow-pink-950/40 ring-1 ring-pink-500',
            inactive: 'bg-[#161b22] border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
        },
        'TikTok': {
            active: 'bg-black border-cyan-400 text-cyan-300 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-400',
            inactive: 'bg-[#161b22] border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
        },
        'Facebook': {
            active: 'bg-blue-600/30 border-blue-500 text-blue-200 shadow-md shadow-blue-950/40 ring-1 ring-blue-500',
            inactive: 'bg-[#161b22] border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
        },
        'YouTube': {
            active: 'bg-red-600/30 border-red-500 text-red-200 shadow-md shadow-red-950/40 ring-1 ring-red-500',
            inactive: 'bg-[#161b22] border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
        }
    };

    function setSocialNetworks(networksStr) {
        const input = document.getElementById('card-social-networks');
        if (!input) return;
        let list = (networksStr || 'Instagram').split(',').map(s => s.trim()).filter(Boolean);
        if (list.length === 0) list = ['Instagram'];
        input.value = list.join(',');

        document.querySelectorAll('.social-net-btn').forEach(btn => {
            const net = btn.getAttribute('data-network');
            const isActive = list.includes(net);
            const style = NETWORK_STYLES[net] || {
                active: 'bg-purple-900 border-purple-500 text-white',
                inactive: 'bg-[#161b22] border-gray-700 text-gray-400'
            };
            btn.className = `social-net-btn flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${isActive ? style.active : style.inactive}`;
        });
    }

    function initSocialNetworksSelector() {
        document.querySelectorAll('.social-net-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const net = btn.getAttribute('data-network');
                const input = document.getElementById('card-social-networks');
                if (!input) return;
                let current = input.value.split(',').map(s => s.trim()).filter(Boolean);
                if (current.includes(net)) {
                    if (current.length > 1) {
                        current = current.filter(n => n !== net);
                    }
                } else {
                    current.push(net);
                }
                setSocialNetworks(current.join(','));
            });
        });

        const formatInput = document.getElementById('card-type');
        if (formatInput) {
            formatInput.addEventListener('change', () => {
                const v = formatInput.value.toLowerCase();
                if (v.includes('reel') || v.includes('tiktok')) {
                    const input = document.getElementById('card-social-networks');
                    if (input) {
                        let cur = input.value.split(',').map(s => s.trim()).filter(Boolean);
                        if (!cur.includes('Instagram')) cur.push('Instagram');
                        if (!cur.includes('TikTok')) cur.push('TikTok');
                        setSocialNetworks(cur.join(','));
                    }
                }
            });
        }
    }

    function getSocialNetworksBadgesHtml(networksStr, isSmall = false) {
        if (!networksStr) return '';
        const list = networksStr.split(',').map(s => s.trim()).filter(Boolean);
        if (list.length === 0) return '';

        return list.map(net => {
            const n = net.toLowerCase();
            const szClass = isSmall ? 'text-[8px] px-1.5 py-0.5' : 'text-[9px] px-1.5 py-0.5';
            if (n.includes('instagram') || n === 'ig') {
                return `<span class="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white font-extrabold ${szClass} rounded shadow-sm flex items-center gap-1 border border-pink-400/60 leading-none"><i class='bx bxl-instagram text-[11px]'></i> IG</span>`;
            }
            if (n.includes('tiktok')) {
                return `<span class="bg-black text-cyan-300 font-extrabold ${szClass} rounded shadow-sm flex items-center gap-1 border border-cyan-400 leading-none"><i class='bx bxl-tiktok text-[11px] text-cyan-300'></i> TikTok</span>`;
            }
            if (n.includes('facebook') || n === 'fb') {
                return `<span class="bg-[#1877F2] text-white font-extrabold ${szClass} rounded shadow-sm flex items-center gap-1 border border-blue-400/60 leading-none"><i class='bx bxl-facebook-circle text-[11px]'></i> FB</span>`;
            }
            if (n.includes('youtube') || n === 'yt') {
                return `<span class="bg-[#FF0000] text-white font-extrabold ${szClass} rounded shadow-sm flex items-center gap-1 border border-red-400/60 leading-none"><i class='bx bxl-youtube text-[11px]'></i> YT</span>`;
            }
            return `<span class="bg-gray-800 text-gray-200 font-bold ${szClass} rounded border border-gray-700 leading-none">${net}</span>`;
        }).join('');
    }

    initSocialNetworksSelector();

    // Open Add Modal
    addCardBtn.addEventListener('click', () => {
        form.reset();
        document.getElementById('card-id').value = '';
        document.getElementById('card-desc').value = defaultCopyTemplate;
        setSocialNetworks('Instagram,TikTok');
        if (document.getElementById('card-status')) document.getElementById('card-status').value = 'Ideas de Contenido';
        if (document.getElementById('card-priority')) document.getElementById('card-priority').value = 'Normal';
        if (document.getElementById('card-assigned')) document.getElementById('card-assigned').value = '';
        if(document.querySelector("#card-date")._flatpickr) {
            document.querySelector("#card-date")._flatpickr.clear();
        }
        
        // Reset preview
        document.getElementById('cover-preview').classList.add('hidden');
        document.getElementById('cover-preview').src = '';
        document.getElementById('cover-dropzone-text').innerText = 'Arrastra una imagen o clic aquí';

        deleteBtn.classList.add('hidden');
        if (sendAlertBtn) sendAlertBtn.classList.remove('hidden');
        modalTitle.innerHTML = 'Nueva Publicación';
        loadUsers();
        populateAssignedDropdown('');
        modal.classList.remove('hidden');
    });

    function closeParrillaModal() {
        if (modal) modal.classList.add('hidden');
    }
    window.closeParrillaModal = closeParrillaModal;

    if (closeBtn) closeBtn.addEventListener('click', closeParrillaModal);

    // Cerrar al hacer clic en el fondo oscuro
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeParrillaModal();
        });
    }

    // Cerrar con la tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeParrillaModal();
        }
    });

    // Init SortableJS for each column
    const columns = document.querySelectorAll('.kanban-cards');
    columns.forEach(col => {
        new Sortable(col, {
            group: 'parrilla',
            animation: 150,
            ghostClass: 'opacity-50',
            delay: 150, // Permite deslizar/scroll vertical en móviles sin activar arrastre accidental
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            onEnd: async function (evt) {
                const itemEl = evt.item;
                const cardId = itemEl.getAttribute('data-id');
                const newStatus = evt.to.closest('.kanban-column').getAttribute('data-status');
                const newIndex = evt.newIndex;
                
                // Update in DB
                try {
                    const res = await fetch(`/api/parrilla/cards/${cardId}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus, order_index: newIndex })
                    });
                    if (!res.ok) throw new Error('Error saving state');
                    updateCounts();
                } catch (err) {
                    console.error(err);
                    alert('Error al mover la tarjeta');
                    loadCards(); // reload original state
                }
            }
        });
    });

    // Helper para navegación rápida entre columnas en móviles
    window.scrollKanbanTo = function(status) {
        let target;
        if (status === 'ig-column') {
            target = document.getElementById('col-ig');
        } else {
            target = document.querySelector(`.kanban-column[data-status="${status}"]`);
        }
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    };

    function getPilarColor(pilar) {
        switch(pilar) {
            case 'Educativo': return 'bg-blue-900/50 text-blue-300 border-blue-800';
            case 'Inspiracional': return 'bg-yellow-900/50 text-yellow-300 border-yellow-800';
            case 'De Venta': return 'bg-green-900/50 text-green-300 border-green-800';
            case 'Personal Branding': return 'bg-pink-900/50 text-pink-300 border-pink-800';
            default: return 'bg-gray-800 text-gray-300 border-gray-700';
        }
    }

    function getPriorityBadge(priority) {
        switch(priority) {
            case 'Urgente':
                return `<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-red-950/80 text-red-300 border border-red-700 animate-pulse">🔥 Urgente</span>`;
            case 'Alta':
                return `<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-orange-950/80 text-orange-300 border border-orange-700">⚡ Alta</span>`;
            case 'En Desarrollo':
                return `<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-blue-950/80 text-blue-300 border border-blue-700">⚙️ En Desarrollo</span>`;
            case 'En Espera':
                return `<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-950/80 text-amber-300 border border-amber-700">⏳ En Espera</span>`;
            case 'Listo':
                return `<span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700">✅ Listo</span>`;
            default:
                return '';
        }
    }

    function renderCard(card) {
        const div = document.createElement('div');
        div.className = 'bg-[#161b22] border border-gray-700 p-3 rounded-lg shadow-sm cursor-grab hover:border-purple-500 transition-colors group';
        div.setAttribute('data-id', card.id);
        
        let dateHtml = '';
        if (card.publish_date) {
            const d = new Date(card.publish_date);
            const now = new Date();
            const diffMs = d - now;
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            
            let badgeHtml = '';
            const isReady = (card.status === 'Recordatorio' || card.status === 'Publicado');
            
            if (diffDays < 0) {
                if (!isReady) {
                    badgeHtml = `<span class="bg-red-900/80 text-red-300 px-1.5 py-0.5 rounded text-[9px] font-bold border border-red-700 animate-pulse">¡ATRASADO!</span>`;
                } else {
                    badgeHtml = `<span class="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded text-[9px] border border-gray-700">Pasado</span>`;
                }
            } else if (diffDays === 0) {
                if (!isReady) {
                    badgeHtml = `<span class="bg-red-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.5)]">¡HOY! Incompleto</span>`;
                } else {
                    badgeHtml = `<span class="bg-green-600/80 text-green-100 px-1.5 py-0.5 rounded text-[9px] font-bold border border-green-500">Programado Hoy</span>`;
                }
            } else if (diffDays <= 3) {
                if (!isReady) {
                    badgeHtml = `<span class="bg-orange-600/80 text-orange-100 px-1.5 py-0.5 rounded text-[9px] font-bold border border-orange-500">Faltan ${diffDays} días</span>`;
                } else {
                    badgeHtml = `<span class="bg-green-900/80 text-green-300 px-1.5 py-0.5 rounded text-[9px] border border-green-700">Listo (${diffDays}d)</span>`;
                }
            } else {
                 badgeHtml = `<span class="text-gray-500 px-1 py-0.5 rounded text-[9px]">${diffDays} días</span>`;
            }

            dateHtml = `
                <div class="mt-2 bg-[#010409] p-2 rounded flex flex-col gap-1 border border-gray-800">
                    <div class="text-[10px] text-gray-300 flex items-center justify-between">
                        <span class="flex items-center gap-1"><i class='bx bx-calendar-event text-neon'></i> ${d.toLocaleDateString([], {month:'short', day:'numeric'})} ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                        ${badgeHtml}
                    </div>
                </div>`;
        }

        let urlsHtml = '';
        if (card.reference_url) {
            urlsHtml += `<a href="${card.reference_url}" target="_blank" class="text-blue-400 hover:underline inline-flex items-center gap-1" onclick="event.stopPropagation()"><i class='bx bx-link'></i> Ref</a> `;
        }
        if (card.media_url) {
            urlsHtml += `<a href="${card.media_url}" target="_blank" class="text-purple-400 hover:underline inline-flex items-center gap-1" onclick="event.stopPropagation()"><i class='bx bx-folder'></i> Archivo</a>`;
        }

        let coverHtml = '';
        if (card.cover_image_url) {
            coverHtml = `<div class="-mt-3 -mx-3 mb-3 h-28 overflow-hidden rounded-t-lg bg-black flex items-center justify-center">
                            <img src="${card.cover_image_url}" alt="Cover" class="w-full h-full object-cover">
                         </div>`;
        }
        
        let assignedHtml = '';
        if (card.assigned_to) {
            assignedHtml = `<div class="mt-2 text-[10px] text-gray-400 bg-gray-900/50 p-1.5 rounded border border-gray-800 flex items-center justify-between">
                <span><i class='bx bx-user-circle'></i> Asignado a:</span>
                <strong class="text-neon font-semibold">${card.assigned_to}</strong>
            </div>`;
        }

        const priorityHtml = getPriorityBadge(card.priority);

        div.innerHTML = `
            ${coverHtml}
            <div class="flex justify-between items-start mb-2 flex-wrap gap-1">
                <span class="text-[10px] px-2 py-0.5 rounded-full border font-semibold ${getPilarColor(card.tags)}">${card.tags || 'Sin Pilar'}</span>
                <div class="flex items-center gap-1">
                    ${priorityHtml}
                    ${card.funnel_stage ? `<span class="text-[9px] px-1.5 py-0.5 bg-gray-800 text-gray-300 rounded font-bold">${card.funnel_stage}</span>` : ''}
                </div>
            </div>
            ${card.content_type || card.social_networks ? `
                <div class="flex items-center justify-between flex-wrap gap-1 mb-1">
                    ${card.content_type ? `<div class="text-[10px] text-gray-400 font-medium flex items-center gap-1"><i class='bx bx-video text-xs'></i> ${card.content_type}</div>` : '<div></div>'}
                    <div class="flex items-center gap-1 flex-wrap">${getSocialNetworksBadgesHtml(card.social_networks, true)}</div>
                </div>
            ` : ''}
            <h4 class="text-sm font-bold text-white mb-1 leading-tight group-hover:text-purple-300 transition-colors">${card.title}</h4>
            <p class="text-[11px] text-gray-400 line-clamp-2 mb-1">${card.description || ''}</p>
            <div class="text-[10px] flex gap-3 mb-1">${urlsHtml}</div>
            ${assignedHtml}
            ${dateHtml}
        `;

        div.addEventListener('click', () => editCard(card));
        return div;
    }

    function editCard(card) {
        document.getElementById('card-id').value = card.id;
        document.getElementById('card-title').value = card.title;
        document.getElementById('card-desc').value = card.description || '';
        document.getElementById('card-type').value = card.content_type || 'TikTok / Reel';
        document.getElementById('card-tags').value = card.tags || 'Educativo';
        document.getElementById('card-funnel').value = card.funnel_stage || '';
        document.getElementById('card-cover-url').value = card.cover_image_url || '';
        document.getElementById('card-ref-url').value = card.reference_url || '';
        document.getElementById('card-media-url').value = card.media_url || '';
        
        setSocialNetworks(card.social_networks || 'Instagram');

        if (document.getElementById('card-status')) {
            document.getElementById('card-status').value = card.status || 'Marca';
        }
        if (document.getElementById('card-priority')) {
            document.getElementById('card-priority').value = card.priority || 'Normal';
        }
        
        loadUsers();
        populateAssignedDropdown(card.assigned_to || '');
        
        // Update Preview
        if (card.cover_image_url) {
            document.getElementById('cover-preview').src = card.cover_image_url;
            document.getElementById('cover-preview').classList.remove('hidden');
            document.getElementById('cover-dropzone-text').innerText = 'Imagen cargada';
        } else {
            document.getElementById('cover-preview').src = '';
            document.getElementById('cover-preview').classList.add('hidden');
            document.getElementById('cover-dropzone-text').innerText = 'Arrastra una imagen o clic aquí';
        }

        if (card.publish_date) {
            const dt = new Date(card.publish_date);
            const d = dt.getDate().toString().padStart(2, '0');
            const m = (dt.getMonth() + 1).toString().padStart(2, '0');
            const y = dt.getFullYear();
            const h = dt.getHours().toString().padStart(2, '0');
            const min = dt.getMinutes().toString().padStart(2, '0');
            document.getElementById('card-date').value = `${d}-${m}-${y} ${h}:${min}`;
            document.querySelector("#card-date")._flatpickr.setDate(dt);
        } else {
            document.getElementById('card-date').value = '';
            document.querySelector("#card-date")._flatpickr.clear();
        }

        deleteBtn.classList.remove('hidden');
        if (sendAlertBtn) sendAlertBtn.classList.remove('hidden');
        modalTitle.innerHTML = 'Editar Publicación';
        modal.classList.remove('hidden');
    }

    // Fechas Especiales de Panamá, Tech, Gamers y Campañas Comerciales
    const panamaTechSpecialDates = [
        // Enero
        { month: 1, day: 1, icon: '🎉', title: 'Año Nuevo: Nueva Tecnología', category: 'comercial', rec: 'Promoción "Empieza el año con celular nuevo". Combos de smartphones + smartwatches/audífonos a crédito.' },
        { month: 1, day: 6, icon: '👑', title: 'Día de Reyes Tech', category: 'comercial', rec: 'Último regalo de reyes: Tablets infantiles, Nintendo Switch y audífonos gamer.' },
        { month: 1, day: 9, icon: '🇵🇦', title: 'Día de los Mártires', category: 'feriado', rec: 'Post institucional de respeto patrio. Cierre de sucursales o horario especial sin venta directa.' },
        { month: 1, day: 28, icon: '🔒', title: 'Día de la Ciberseguridad', category: 'tech_gamer', rec: 'Educativo: Tips para proteger tu iPhone/Android de estafas en Panamá y clonación de WhatsApp.' },

        // Febrero
        { month: 2, day: 4, icon: '🕹️', title: 'Día de Videojuegos Retro', category: 'gamer', rec: 'Promoción de consolas retro, emuladores para celulares potentes y mandos Bluetooth.' },
        { month: 2, day: 14, icon: '❤️', title: 'San Valentín Tech', category: 'comercial', rec: 'Campaña "Conecta con tu amor": 2x1 en audífonos inalámbricos, smartwatches para parejas o iPhone en combo.' },
        { month: 2, day: 17, icon: '🎭', title: 'Carnavales Panamá (Culecos)', category: 'feriado', rec: 'Crucial: Fundas waterproof / sumergibles, bocinas resistentes al agua y powerbanks de carga rápida para la playa.' },

        // Marzo
        { month: 3, day: 1, icon: '🎒', title: 'Back to School Panamá', category: 'comercial', rec: 'Temporada escolar/universitaria: Laptops HP/Lenovo, tablets y celulares para estudiantes a crédito en cuotas quincenales.' },
        { month: 3, day: 8, icon: '👩', title: 'Día de la Mujer Tech', category: 'comercial', rec: 'Descuento especial en accesorios estéticos, iPhone colores pastel y smartwatches.' },
        { month: 3, day: 10, icon: '🍄', title: 'Mario Day (Mar10)', category: 'gamer', rec: 'Promo especial en consolas Nintendo Switch, juegos y mandos.' },
        { month: 3, day: 31, icon: '💾', title: 'Día del Respaldo (Backup Day)', category: 'tech_gamer', rec: 'Tutorial: Cómo respaldar tus fotos y contactos antes de formatear o cambiar de celular en Ecosystems.' },

        // Abril
        { month: 4, day: 15, icon: '🎨', title: 'Día del Diseño & Creadores', category: 'tech_gamer', rec: 'Laptops para diseño y edición de video, iPads con lápiz y pantallas de alta resolución.' },
        { month: 4, day: 22, icon: '🌍', title: 'Día de la Tierra (Plan Canje)', category: 'tech_gamer', rec: 'Campaña Trade-In: "Trae tu celular usado y úsalo como abono para tu nuevo smartphone".' },

        // Mayo
        { month: 5, day: 1, icon: '🛠️', title: 'Día del Trabajador', category: 'feriado', rec: 'Premia tu quincena: "Te lo mereces, saca tu celular sin abono inicial con entrega inmediata".' },
        { month: 5, day: 4, icon: '🚀', title: 'May the 4th (Star Wars Day)', category: 'gamer', rec: 'Contenido geek: Accesorios temáticos, setups gamer y personalización de smartphones.' },
        { month: 5, day: 17, icon: '🌐', title: 'Día Mundial de Internet 5G', category: 'tech_gamer', rec: 'Comparativa de celulares con mejor conectividad 5G en Panamá.' },

        // Junio
        { month: 6, day: 10, icon: '📱', title: 'Apple WWDC / Novedades iOS', category: 'tech_gamer', rec: 'Cobertura de las nuevas funciones de Apple y compatibilidad de iPhones vendidos en tienda.' },
        { month: 6, day: 21, icon: '👔', title: 'Día del Padre en Panamá', category: 'comercial', rec: 'Campaña top comercial: "El regalo perfecto para papá". Celulares resistentes, smartwatches y gadgets para autos.' },
        { month: 6, day: 23, icon: '💻', title: 'Día del Setup / PC Gamer', category: 'gamer', rec: 'Laptops de alto rendimiento, componentes y accesorios de oficina tecnológica.' },

        // Julio
        { month: 7, day: 15, icon: '🎮', title: 'Vacaciones Gaming Panamá', category: 'gamer', rec: 'Kits gamers: Audífonos con luces RGB, mandos para celular, gatillos y consolas.' },
        { month: 7, day: 19, icon: '👶', title: 'Día del Niño en Panamá', category: 'comercial', rec: 'Regalos tech: Tablets para niños con control parental, Nintendo Switch y audífonos infantiles.' },

        // Agosto
        { month: 8, day: 15, icon: '🇵🇦', title: 'Fundación de Panamá La Vieja', category: 'feriado', rec: 'Feriado en Ciudad de Panamá: Trivia sobre historia panameña con cupones de descuento en accesorios.' },
        { month: 8, day: 29, icon: '🕹️', title: 'Día Mundial del Gamer', category: 'gamer', rec: '¡EVENTO TOP GAMING! Torneo en tienda, sorteo de periféricos y super ofertas en consolas PlayStation/Xbox/Switch.' },

        // Septiembre
        { month: 9, day: 12, icon: '🍏', title: 'Lanzamiento Anual Nuevo iPhone', category: 'tech_gamer', rec: '¡FECHA DE ORO! Cobertura del nuevo iPhone: "Ya abrimos lista de reserva exclusiva en Ecosystems".' },
        { month: 9, day: 20, icon: '🛍️', title: 'Panamá Black Weekend', category: 'black_friday', rec: 'Fin de semana comercial top en Panamá: Descuentos gigantes en smartphones Android e iPhone.' },

        // Octubre
        { month: 10, day: 1, icon: '🎀', title: 'Mes de la Cinta Rosada', category: 'comercial', rec: 'Campaña de concienciación: Celulares y estuches rosados con donación a la causa.' },
        { month: 10, day: 31, icon: '🎃', title: 'Halloween Tech (Precios de Miedo)', category: 'comercial', rec: 'Precios de terror: Descuentos flash por 24 horas y concurso de disfraces en tienda.' },

        // Noviembre
        { month: 11, day: 3, icon: '🇵🇦', title: 'Separación de Colombia', category: 'feriado', rec: 'Fiestas Patrias: Horarios especiales de atención en Dorado Mall.' },
        { month: 11, day: 4, icon: '🇵🇦', title: 'Día de los Símbolos Patrios', category: 'feriado', rec: 'Orgullo panameño. Celulares con los colores de la bandera tricolor.' },
        { month: 11, day: 10, icon: '🇵🇦', title: 'Grito de La Villa de Los Santos', category: 'feriado', rec: 'Feriado nacional: Descuentos patrios para compras en el interior del país con envío express.' },
        { month: 11, day: 27, icon: '🔥', title: 'BLACK FRIDAY PANAMÁ', category: 'black_friday', rec: '¡EL DÍA COMERCIAL MÁS GRANDE DEL AÑO! Descuentos masivos en todo el stock de celulares, laptops y consolas.' },
        { month: 11, day: 28, icon: '🇵🇦', title: 'Independencia de España', category: 'feriado', rec: 'Continuación de ofertas del Black Weekend patrio.' },
        { month: 11, day: 30, icon: '💻', title: 'CYBER MONDAY PANAMÁ', category: 'black_friday', rec: 'Remate de ofertas online en ecosystempty.com con envíos gratis a todo Panamá.' },

        // Diciembre
        { month: 12, day: 8, icon: '💐', title: 'Día de la Madre en Panamá', category: 'comercial', rec: '¡MÁXIMA FECHA COMERCIAL DE PANAMÁ! Campaña "Mamá se merece el mejor celular". Combos de teléfono + accesorios estéticos a crédito.' },
        { month: 12, day: 24, icon: '🎄', title: 'Nochebuena & Navidad Tech', category: 'comercial', rec: 'Campaña "Regala Tecnología": Guía de regalos tech por presupuesto ($50, $150, $300, premium).' },
        { month: 12, day: 31, icon: '🥂', title: 'Fin de Año', category: 'comercial', rec: 'Liquidación de año nuevo: Estrena celular para empezar el nuevo ciclo con el pie derecho.' }
    ];

    async function loadCards() {
        try {
            const res = await fetch('/api/parrilla/cards');
            const data = await res.json();
            if (data.success) {
                allCards = data.cards;
                // Clear columns
                document.querySelectorAll('.kanban-cards').forEach(c => c.innerHTML = '');
                
                // Append
                allCards.forEach(card => {
                    const colStatus = card.status || 'Marca';
                    const col = document.querySelector(`.kanban-column[data-status="${colStatus}"] .kanban-cards`);
                    if (col) {
                        col.appendChild(renderCard(card));
                    } else {
                        const fallback = document.querySelector('.kanban-column .kanban-cards');
                        if (fallback) fallback.appendChild(renderCard(card));
                    }
                });
                updateCounts();
                updateAdminKPIs();
                
                // Update Calendar events
                if (calendar) {
                    calendar.removeAllEvents();
                    const events = allCards.filter(c => c.publish_date).map(c => {
                        let color = '#9333ea'; // default purple
                        if (c.priority === 'Urgente') color = '#dc2626'; // red
                        else if (c.priority === 'Alta') color = '#ea580c'; // orange
                        else if (c.priority === 'En Desarrollo') color = '#2563eb'; // blue
                        else if (c.priority === 'En Espera') color = '#d97706'; // amber
                        else if (c.priority === 'Listo' || c.status === 'Recordatorio') color = '#16a34a'; // green
                        else if (c.status === 'Contenido Extra (Jess)') color = '#ea580c'; // orange

                        return {
                            id: c.id,
                            title: c.title,
                            start: c.publish_date,
                            backgroundColor: color,
                            borderColor: 'transparent',
                            extendedProps: {
                                cover_image_url: c.cover_image_url,
                                tags: c.tags,
                                funnel_stage: c.funnel_stage,
                                content_type: c.content_type,
                                assigned_to: c.assigned_to,
                                priority: c.priority,
                                status: c.status,
                                social_networks: c.social_networks
                            }
                        };
                    });

                    // Añadir hito obligatorio por default en todos los meses: Entrega de Calendario el 15
                    const curYear = new Date().getFullYear();
                    for (let y = curYear - 1; y <= curYear + 1; y++) {
                        for (let m = 0; m < 12; m++) {
                            const mStr = (m + 1).toString().padStart(2, '0');
                            events.push({
                                id: `deadline-15-${y}-${mStr}`,
                                title: 'ENTREGA DE CALENDARIO DEL MES',
                                start: `${y}-${mStr}-15`,
                                allDay: true,
                                backgroundColor: '#b91c1c',
                                borderColor: '#facc15',
                                extendedProps: {
                                    isSystemDeadline: true,
                                    status: 'FECHA LÍMITE',
                                    priority: 'Urgente'
                                }
                            });
                        }
                    }

                    // Añadir Fechas Especiales de Panamá, Tech, Gamers y Black Friday al calendario
                    panamaTechSpecialDates.forEach((spec, idx) => {
                        for (let y = curYear - 1; y <= curYear + 1; y++) {
                            const mStr = spec.month.toString().padStart(2, '0');
                            const dStr = spec.day.toString().padStart(2, '0');
                            events.push({
                                id: `special-${idx}-${y}-${mStr}-${dStr}`,
                                title: spec.title,
                                start: `${y}-${mStr}-${dStr}`,
                                allDay: true,
                                extendedProps: {
                                    isSpecialDate: true,
                                    icon: spec.icon,
                                    category: spec.category,
                                    recommendation: spec.rec
                                }
                            });
                        }
                    });

                    calendar.addEventSource(events);
                }
            }
        } catch (err) {
            console.error('Failed to load cards', err);
        }
    }

    function updateCounts() {
        let total = 0;
        document.querySelectorAll('.kanban-column').forEach(col => {
            const status = col.getAttribute('data-status');
            const count = col.querySelectorAll('.kanban-cards > div').length;
            total += count;
            const countBadge = col.querySelector('.card-count');
            if (countBadge) {
                countBadge.innerText = count;
            }
            // Actualizar badge en la barra de resumen superior
            const summaryBadge = document.getElementById(`summary-count-${status}`);
            if (summaryBadge) {
                summaryBadge.innerText = count;
            }
        });
        const totalBadge = document.getElementById('summary-total-count');
        if (totalBadge) {
            totalBadge.innerText = total;
        }
        if (typeof updateAdminKPIs === 'function') {
            updateAdminKPIs();
        }
    }

    // Handle Cover Image Upload
    const coverInput = document.getElementById('cover-file-input');
    if (coverInput) {
        coverInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            document.getElementById('cover-dropzone-text').innerText = 'Cargando imagen...';
            
            const reader = new FileReader();
            reader.onload = function(evt) {
                const base64 = evt.target.result;
                document.getElementById('card-cover-url').value = base64;
                document.getElementById('cover-preview').src = base64;
                document.getElementById('cover-preview').classList.remove('hidden');
                document.getElementById('cover-dropzone-text').innerText = 'Imagen cargada';
            };
            reader.onerror = function() {
                alert('Error al leer la imagen');
                document.getElementById('cover-dropzone-text').innerText = 'Error';
            };
            reader.readAsDataURL(file);
            
            // Reset input so it can trigger change again
            e.target.value = '';
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const titleVal = document.getElementById('card-title').value.trim();
        if (!titleVal) {
            alert('⚠️ Por favor, ponle un Título a la publicación antes de guardar.');
            return;
        }

        const id = document.getElementById('card-id').value;
        
        let publishDate = null;
        const dateInput = document.getElementById('card-date').value;
        if (dateInput) {
            try {
                let cleanedDate = dateInput.trim();
                const [datePart, timePart] = cleanedDate.split(' ');
                
                if (datePart) {
                    const sep = datePart.includes('/') ? '/' : '-';
                    const parts = datePart.split(sep);
                    if (parts.length === 3) {
                        const d = parts[0];
                        const m = parts[1];
                        const y = parts[2];
                        const t = timePart ? timePart : '12:00';
                        publishDate = `${y}-${m}-${d}T${t}:00`;
                    } else {
                        publishDate = new Date(cleanedDate).toISOString();
                    }
                }
            } catch (e) {
                console.error("Invalid date format", e);
            }
        }

        const payload = {
            title: titleVal,
            description: document.getElementById('card-desc').value,
            status: document.getElementById('card-status') ? document.getElementById('card-status').value : 'Marca',
            priority: document.getElementById('card-priority') ? document.getElementById('card-priority').value : 'Normal',
            content_type: document.getElementById('card-type').value,
            tags: document.getElementById('card-tags').value,
            funnel_stage: document.getElementById('card-funnel').value,
            cover_image_url: document.getElementById('card-cover-url').value,
            reference_url: document.getElementById('card-ref-url').value,
            media_url: document.getElementById('card-media-url').value,
            publish_date: publishDate,
            assigned_to: document.getElementById('card-assigned') ? document.getElementById('card-assigned').value : null,
            social_networks: document.getElementById('card-social-networks') ? document.getElementById('card-social-networks').value : 'Instagram'
        };

        try {
            let res;
            if (id) {
                res = await fetch(`/api/parrilla/cards/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                res = await fetch(`/api/parrilla/cards`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            
            if (res.ok) {
                modal.classList.add('hidden');
                loadCards();
            } else {
                const errData = await res.json();
                alert('Error: ' + (errData.error || 'Desconocido'));
            }
        } catch (err) {
            console.error(err);
            alert('Error al guardar la tarjeta (Revisa consola)');
        }
    });

    deleteBtn.addEventListener('click', async () => {
        if (!confirm('¿Deseas enviar esta publicación a la papelera? Podrás recuperarla en cualquier momento.')) return;
        const id = document.getElementById('card-id').value;
        try {
            const res = await fetch(`/api/parrilla/cards/${id}`, { method: 'DELETE' });
            if (res.ok) {
                modal.classList.add('hidden');
                loadCards();
                if (typeof showToast === 'function') {
                    showToast('Papelera 🗑️', 'Publicación movida a la papelera. Puedes recuperarla cuando quieras.', 'yellow');
                }
            }
        } catch (err) {
            console.error(err);
            alert('Error al enviar a la papelera');
        }
    });

    window.openTrashModal = function() {
        const modal = document.getElementById('parrilla-trash-modal');
        if (modal) {
            modal.classList.remove('hidden');
            loadTrashCards();
        }
    };

    window.closeTrashModal = function() {
        const modal = document.getElementById('parrilla-trash-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    };

    async function loadTrashCards() {
        const container = document.getElementById('trash-cards-list');
        if (!container) return;
        container.innerHTML = '<div class="flex justify-center py-8"><div class="loader"></div></div>';
        try {
            const res = await fetch('/api/parrilla/trash');
            const data = await res.json();
            if (data.success && Array.isArray(data.cards)) {
                if (data.cards.length === 0) {
                    container.innerHTML = `
                        <div class="text-center py-12 text-gray-500">
                            <i class='bx bx-trash text-4xl mb-2 text-gray-600 block'></i>
                            <p class="text-sm font-semibold text-gray-400">La papelera está vacía</p>
                            <p class="text-xs text-gray-500 mt-1">No hay tareas o publicaciones eliminadas recientemente.</p>
                        </div>
                    `;
                    return;
                }

                container.innerHTML = data.cards.map(card => {
                    const deletedDate = card.deleted_at ? new Date(card.deleted_at).toLocaleString('es-PA', { dateStyle: 'short', timeStyle: 'short' }) : 'Recientemente';
                    return `
                        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-[#161b22] border border-gray-800 rounded-xl gap-3 hover:border-gray-700 transition-all">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1 flex-wrap">
                                    <span class="text-xs px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 font-semibold">${card.status || 'Marca'}</span>
                                    ${card.priority && card.priority !== 'Normal' ? `<span class="text-[10px] px-1.5 py-0.2 rounded bg-red-900/40 text-red-300 border border-red-800/40 font-semibold">${card.priority}</span>` : ''}
                                    <span class="text-[11px] text-gray-500 flex items-center gap-1"><i class='bx bx-time'></i> Eliminado: ${deletedDate}</span>
                                </div>
                                <h4 class="text-sm font-bold text-white truncate">${card.title}</h4>
                                ${card.description ? `<p class="text-xs text-gray-400 line-clamp-1 mt-0.5">${card.description}</p>` : ''}
                            </div>
                            <div class="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-800">
                                <button onclick="restoreTrashCard(${card.id})" class="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all">
                                    <i class='bx bx-undo text-base'></i> Restaurar
                                </button>
                                <button onclick="permanentDeleteTrashCard(${card.id})" class="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1 transition-all" title="Eliminar para siempre">
                                    <i class='bx bx-trash text-sm'></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                container.innerHTML = '<div class="text-center py-6 text-red-400 text-xs">Error al cargar elementos de la papelera.</div>';
            }
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="text-center py-6 text-red-400 text-xs">Error al conectar con la papelera.</div>';
        }
    }

    window.restoreTrashCard = async function(id) {
        try {
            const res = await fetch(`/api/parrilla/cards/${id}/restore`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.success) {
                if (typeof showToast === 'function') {
                    showToast('Publicación Restaurada ✅', 'La tarea ha vuelto a su columna correspondiente en el tablero.', 'green');
                }
                loadTrashCards();
                loadCards();
            } else {
                alert('No se pudo restaurar la publicación');
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión al restaurar');
        }
    };

    window.permanentDeleteTrashCard = async function(id) {
        if (!confirm('⚠️ ¿Estás totalmente seguro de eliminarla definitivamente? Esta acción NO se puede deshacer.')) return;
        try {
            const res = await fetch(`/api/parrilla/cards/${id}/hard`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                if (typeof showToast === 'function') {
                    showToast('Eliminada Definitivamente 🗑️', 'La publicación fue borrada permanentemente.', 'gray');
                }
                loadTrashCards();
            } else {
                alert('No se pudo eliminar definitivamente');
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
        }
    };

    function buildClientWhatsappMessage(cardData) {
        let msg = `📢 *¡AVISO DE PARRILLA DE CONTENIDO!* 🚀\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📌 *Título:* ${cardData.title || 'Sin Título'}\n`;
        if (cardData.status) msg += `🏷️ *Paso / Fase actual:* ${cardData.status}\n`;
        if (cardData.social_networks) msg += `🌐 *Redes Sociales:* ${cardData.social_networks}\n`;
        if (cardData.priority) msg += `⚡ *Prioridad:* ${cardData.priority}\n`;
        if (cardData.assigned_to) msg += `👤 *Asignado a:* ${cardData.assigned_to}\n`;
        if (cardData.content_type) msg += `🎬 *Formato:* ${cardData.content_type}\n`;
        if (cardData.tags) msg += `📚 *Pilar:* ${cardData.tags}\n`;
        if (cardData.funnel_stage) msg += `🎯 *Etapa Funnel:* ${cardData.funnel_stage}\n`;
        if (cardData.dateRaw) msg += `⏰ *Fecha Programada:* ${cardData.dateRaw}\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Regla obligatoria: Todo Reel de Instagram también va en TikTok
        const cType = (cardData.content_type || '').toLowerCase();
        const cTitle = (cardData.title || '').toLowerCase();
        const cNets = (cardData.social_networks || '').toLowerCase();
        const isReel = cType.includes('reel') || cTitle.includes('reel') || (cNets.includes('instagram') && (cType.includes('video') || cType.includes('tiktok')));

        if (isReel || cNets.includes('instagram') || cNets.includes('tiktok')) {
            msg += `⚠️ *REGLA OBLIGATORIA DE CONTENIDO:*\n¡Todo REEL que se publique en Instagram también DEBE publicarse en TikTok (@ecosystems_celular)! 📲🔥\n\n`;
        }
        if (cardData.description && cardData.description.trim()) {
            msg += `📝 *COPY / GUION / DETALLES:*\n${cardData.description.trim()}\n\n`;
        }
        if (cardData.reference_url) {
            msg += `🔗 *Referencia:* ${cardData.reference_url}\n`;
        }
        if (cardData.media_url) {
            msg += `📁 *Carpeta / Arte Final:* ${cardData.media_url}\n`;
        }
        msg += `\n⚡ _CRM Ecosystems PTY (@ecosystems_celular)_`;
        return msg;
    }

    function openWhatsAppDispatchModal(formattedMessage, botSentSuccess = false, statusNote = '') {
        let existing = document.getElementById('wa-dispatch-modal');
        if (existing) existing.remove();

        const encodedMsg = encodeURIComponent(formattedMessage);
        const modalEl = document.createElement('div');
        modalEl.id = 'wa-dispatch-modal';
        modalEl.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-center justify-center p-3 sm:p-6 overflow-y-auto';
        modalEl.innerHTML = `
            <div class="bg-[#0d1117] border border-green-500/40 rounded-2xl w-full max-w-xl md:max-w-3xl shadow-2xl overflow-hidden animate-fade-in my-auto max-h-[92vh] flex flex-col">
                <div class="p-3.5 sm:p-4 bg-gradient-to-r from-green-950/80 to-[#161b22] border-b border-gray-800 flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 shrink-0">
                            <i class='bx bxl-whatsapp text-2xl'></i>
                        </div>
                        <div>
                            <h3 class="text-xs sm:text-sm font-bold text-white">Avisar al Equipo por WhatsApp</h3>
                            <p class="text-[10px] sm:text-[11px] text-green-400 font-medium">${botSentSuccess ? '✅ Enviado por el Bot + Envío Directo 1-Clic' : '⚡ Envío Directo 1-Clic a cada miembro'}</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('wa-dispatch-modal').remove()" class="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
                        <i class='bx bx-x text-2xl'></i>
                    </button>
                </div>
                
                <div class="p-3.5 sm:p-5 space-y-3 overflow-y-auto custom-scrollbar flex-1">
                    ${statusNote ? `
                        <div class="p-2.5 rounded-xl bg-amber-950/40 border border-amber-700/50 text-[11px] text-amber-200 flex items-start gap-2">
                            <i class='bx bx-info-circle text-amber-400 text-base shrink-0 mt-0.5'></i>
                            <div>
                                <span>${statusNote}</span>
                                <button type="button" onclick="document.getElementById('wa-dispatch-modal').remove(); if(typeof openWAStatusModal==='function') openWAStatusModal();" class="block mt-1 text-neon underline font-bold hover:text-green-300">
                                    🔗 Vincular QR del Bot del Servidor aquí
                                </button>
                            </div>
                        </div>
                    ` : ''}

                    <div>
                        <div class="text-xs text-gray-300 font-semibold mb-2 flex items-center justify-between">
                            <span>Haz clic para enviar el aviso con toda la ficha cargada:</span>
                            <span class="text-[10px] text-gray-500 hidden sm:inline">1 clic por integrante</span>
                        </div>

                        <!-- Grid 2 Columnas Horizontal en Desktop / 1 Columna en Móvil -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                            <a href="https://wa.me/50762945801?text=${encodedMsg}" target="_blank" class="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-green-600/15 hover:bg-green-600/30 border border-green-500/30 transition-all group">
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <i class='bx bxl-whatsapp text-2xl text-green-400 shrink-0'></i>
                                    <div class="min-w-0">
                                        <div class="text-xs font-bold text-white group-hover:text-green-300 truncate">Gre (Grecia - CM)</div>
                                        <div class="text-[10px] text-gray-400 truncate">+507 6294-5801 • Community Manager</div>
                                    </div>
                                </div>
                                <span class="text-xs font-bold text-green-400 flex items-center gap-1 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform">Enviar <i class='bx bx-link-external'></i></span>
                            </a>

                            <a href="https://wa.me/50769216661?text=${encodedMsg}" target="_blank" class="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-purple-600/15 hover:bg-purple-600/30 border border-purple-500/30 transition-all group">
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <i class='bx bxl-whatsapp text-2xl text-purple-400 shrink-0'></i>
                                    <div class="min-w-0">
                                        <div class="text-xs font-bold text-white group-hover:text-purple-300 truncate">Jess (Jessica)</div>
                                        <div class="text-[10px] text-gray-400 truncate">+507 6921-6661 • Dirección / Admin</div>
                                    </div>
                                </div>
                                <span class="text-xs font-bold text-purple-300 flex items-center gap-1 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform">Enviar <i class='bx bx-link-external'></i></span>
                            </a>

                            <a href="https://wa.me/50762589395?text=${encodedMsg}" target="_blank" class="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 transition-all group">
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <i class='bx bxl-whatsapp text-2xl text-blue-400 shrink-0'></i>
                                    <div class="min-w-0">
                                        <div class="text-xs font-bold text-white group-hover:text-blue-300 truncate">Angel</div>
                                        <div class="text-[10px] text-gray-400 truncate">+507 6258-9395 • Comercial</div>
                                    </div>
                                </div>
                                <span class="text-xs font-bold text-blue-300 flex items-center gap-1 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform">Enviar <i class='bx bx-link-external'></i></span>
                            </a>

                            <a href="https://wa.me/50768306207?text=${encodedMsg}" target="_blank" class="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-amber-600/15 hover:bg-amber-600/30 border border-amber-500/30 transition-all group">
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <i class='bx bxl-whatsapp text-2xl text-amber-400 shrink-0'></i>
                                    <div class="min-w-0">
                                        <div class="text-xs font-bold text-white group-hover:text-amber-300 truncate">Alexis (Admin)</div>
                                        <div class="text-[10px] text-gray-400 truncate">+507 6830-6207 • Administrador</div>
                                    </div>
                                </div>
                                <span class="text-xs font-bold text-amber-300 flex items-center gap-1 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform">Enviar <i class='bx bx-link-external'></i></span>
                            </a>
                        </div>
                    </div>

                    <div class="pt-1">
                        <label class="block text-[10px] text-gray-400 uppercase font-bold mb-1">Vista previa del mensaje:</label>
                        <textarea id="wa-dispatch-preview-text" readonly rows="3" class="w-full bg-[#161b22] border border-gray-800 rounded-lg p-2.5 text-[11px] text-gray-300 font-mono focus:outline-none max-h-24 sm:max-h-28 overflow-y-auto leading-relaxed custom-scrollbar">${formattedMessage}</textarea>
                    </div>

                    <div class="flex items-center justify-between gap-2 pt-1">
                        <button type="button" id="wa-copy-msg-btn" class="flex-1 py-2 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-gray-700 transition-colors cursor-pointer">
                            <i class='bx bx-copy'></i> Copiar para Grupo
                        </button>
                        <button type="button" onclick="document.getElementById('wa-dispatch-modal').remove()" class="py-2 px-4 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white text-xs font-semibold border border-gray-800 transition-colors cursor-pointer">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        const copyBtn = document.getElementById('wa-copy-msg-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(formattedMessage).then(() => {
                    copyBtn.innerHTML = `<i class='bx bx-check text-green-400'></i> ¡Copiado al portapapeles!`;
                    setTimeout(() => {
                        copyBtn.innerHTML = `<i class='bx bx-copy'></i> Copiar para Grupo`;
                    }, 2500);
                });
            });
        }
    }

    function buildClientDailyStoriesMessage() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-PA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        let msg = `📲 *¡AVISO DIARIO: SUBIR HISTORIAS EN INSTAGRAM Y TIKTOK!* 🔥\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📅 *Fecha:* ${dateStr}\n`;
        msg += `📱 *Cuentas:* Instagram & TikTok (@ecosystems_celular)\n`;
        msg += `👤 *Equipo:* Gre (CM), Jess, Angel & Alexis\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        msg += `✅ *TAREAS DIARIAS DE HISTORIAS (IG + TIKTOK):*\n`;
        msg += `1️⃣ *Apertura / Tienda Activa:* Mostrar vitrina, equipos disponibles o ambiente en tienda.\n`;
        msg += `2️⃣ *Producto Estrella / Oferta del Día:* Celular, laptop o consola gamer (Crédito / Contado).\n`;
        msg += `3️⃣ *Interacción / Clientes:* Entregas del día, dinámicas o recordatorio de financiamiento.\n`;
        msg += `4️⃣ *TikTok Stories:* Replicar las historias del día en el perfil de TikTok.\n\n`;
        msg += `💡 *REGLA OBLIGATORIA DE CONTENIDO:*\n¡Todo REEL que se publique en Instagram también DEBE publicarse en TikTok (@ecosystems_celular)! 📲🔥\n\n`;
        msg += `🔗 *IG:* https://www.instagram.com/ecosystems_celular/\n`;
        msg += `🔗 *TikTok:* https://www.tiktok.com/@ecosystems_celular\n`;
        msg += `\n⚡ _Recordatorio Diario Automático • CRM Ecosystems PTY_`;
        return msg;
    }

    window.triggerDailyStoriesAlert = async function() {
        const btn = document.getElementById('daily-stories-alert-btn');
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class='bx bx-loader-alt animate-spin text-green-400 text-base'></i> <span>Enviando aviso de Historias...</span>`;
        }

        const fallbackMsg = buildClientDailyStoriesMessage();

        try {
            const res = await fetch('/api/parrilla/stories-alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const rawText = await res.text();
            let data = {};
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                data = { success: false, formattedMessage: fallbackMsg };
            }

            const finalMsg = data.formattedMessage || fallbackMsg;

            if (res.ok && data.success) {
                if (typeof showToast === 'function') {
                    showToast('Historias IG & TikTok 📲', data.message, 'green');
                }
                openWhatsAppDispatchModal(finalMsg, true, '');
            } else {
                if (typeof showToast === 'function') {
                    showToast('⏳ En Cola Automática (9AM / 30m)', 'El aviso quedó esperando conexión. Apenas conecte el WhatsApp o en el próximo intento de 30 min saldrá solo.', 'yellow');
                }
                openWhatsAppDispatchModal(
                    finalMsg,
                    false,
                    '⏳ Aviso guardado EN COLA AUTOMÁTICA: El sistema intentará enviarlo cada 30 minutos (desde las 9:00 AM) y saldrá al instante apenas detecte conexión de WhatsApp. Si lo deseas, también puedes enviarlo manualmente aquí:'
                );
            }
        } catch (err) {
            console.error(err);
            openWhatsAppDispatchModal(
                fallbackMsg,
                false,
                'Envía el recordatorio diario de Historias (Instagram y TikTok) con 1 clic a Gre (CM), Jess, Angel o Alexis:'
            );
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    if (sendAlertBtn) {
        sendAlertBtn.addEventListener('click', async () => {
            const id = document.getElementById('card-id').value || 'direct';
            const titleVal = document.getElementById('card-title').value.trim() || 'Publicación en Parrilla';
            const dateRaw = document.getElementById('card-date') ? document.getElementById('card-date').value.trim() : '';

            let publishDate = null;
            if (dateRaw) {
                try {
                    const [datePart, timePart] = dateRaw.split(' ');
                    if (datePart) {
                        const sep = datePart.includes('/') ? '/' : '-';
                        const parts = datePart.split(sep);
                        if (parts.length === 3) {
                            publishDate = `${parts[2]}-${parts[1]}-${parts[0]}T${timePart || '12:00'}:00`;
                        }
                    }
                } catch (e) {}
            }

            const liveCardPayload = {
                title: titleVal,
                description: document.getElementById('card-desc') ? document.getElementById('card-desc').value : '',
                status: document.getElementById('card-status') ? document.getElementById('card-status').value : 'Marca',
                priority: document.getElementById('card-priority') ? document.getElementById('card-priority').value : 'Normal',
                content_type: document.getElementById('card-type') ? document.getElementById('card-type').value : '',
                tags: document.getElementById('card-tags') ? document.getElementById('card-tags').value : '',
                funnel_stage: document.getElementById('card-funnel') ? document.getElementById('card-funnel').value : '',
                assigned_to: document.getElementById('card-assigned') ? document.getElementById('card-assigned').value : '',
                reference_url: document.getElementById('card-ref-url') ? document.getElementById('card-ref-url').value : '',
                media_url: document.getElementById('card-media-url') ? document.getElementById('card-media-url').value : '',
                publish_date: publishDate,
                dateRaw: dateRaw,
                social_networks: document.getElementById('card-social-networks') ? document.getElementById('card-social-networks').value : 'Instagram'
            };

            const fallbackMsg = buildClientWhatsappMessage(liveCardPayload);

            const originalHtml = sendAlertBtn.innerHTML;
            sendAlertBtn.disabled = true;
            sendAlertBtn.innerHTML = `<i class='bx bx-loader-alt animate-spin text-base'></i> Conectando...`;

            try {
                const res = await fetch(`/api/parrilla/cards/${id}/send-alert`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(liveCardPayload)
                });
                const rawText = await res.text();
                let data = {};
                try {
                    data = JSON.parse(rawText);
                } catch (parseErr) {
                    data = { success: false, formattedMessage: fallbackMsg };
                }

                const finalMsg = data.formattedMessage || fallbackMsg;

                if (res.ok && data.success) {
                    if (typeof showToast === 'function') {
                        showToast('Aviso Enviado por Bot 📲', data.message, 'green');
                    }
                    openWhatsAppDispatchModal(finalMsg, true, '');
                } else {
                    if (typeof showToast === 'function') {
                        showToast('⏳ Post en Cola Automática', 'Quedó en espera: el servidor lo enviará solo apenas conecte el WhatsApp o en el reintento cada 30 min.', 'yellow');
                    }
                    openWhatsAppDispatchModal(
                        finalMsg,
                        false,
                        '⏳ Este post quedó EN COLA AUTOMÁTICA: Si el WhatsApp del CRM no está conectado ahora, el servidor lo reintentará cada 30 minutos y lo enviará apenas detecte conexión. También puedes enviarlo ahora con 1 clic:'
                    );
                }
            } catch (err) {
                console.error(err);
                openWhatsAppDispatchModal(
                    fallbackMsg,
                    false,
                    'Envía el aviso directamente con 1 clic a Gre (CM), Jess o Angel:'
                );
            } finally {
                sendAlertBtn.disabled = false;
                sendAlertBtn.innerHTML = originalHtml;
            }
        });
    }

    let cachedUsers = [];
    const defaultTeamUsers = [
        { username: 'gre', role: 'content_manager', label: 'gre (Grecia - CM)' },
        { username: 'jess', role: 'admin', label: 'jess (Jessica)' },
        { username: 'angel', role: 'vendedor', label: 'angel (Ventas)' },
        { username: 'alexis', role: 'admin', label: 'alexis (Admin)' }
    ];

    async function loadUsers() {
        try {
            const res = await fetch('/api/sellers');
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    cachedUsers = data.data;
                }
            }
        } catch (e) {
            console.error('Error load users', e);
        }
        const currentSelected = document.getElementById('card-assigned') ? document.getElementById('card-assigned').value : '';
        populateAssignedDropdown(currentSelected);
    }

    function populateAssignedDropdown(selectedValue = '') {
        const select = document.getElementById('card-assigned');
        if (!select) return;

        let html = '<option value="">-- Sin asignar --</option>';
        const map = new Map();

        // 1. Agregar usuarios por defecto garantizados para que Grecia siempre aparezca
        defaultTeamUsers.forEach(u => {
            map.set(u.username.toLowerCase(), {
                username: u.username,
                label: u.label
            });
        });

        // 2. Agregar o combinar con los usuarios de la base de datos
        cachedUsers.forEach(u => {
            const key = u.username.toLowerCase();
            let label = u.username;
            if (u.role === 'content_manager') label += ' (CM)';
            else if (u.role === 'admin') label += ' (Admin)';
            else if (u.role === 'vendedor') label += ' (Vendedor)';
            map.set(key, {
                username: u.username,
                label: map.has(key) ? map.get(key).label : label
            });
        });

        // 3. Si la tarjeta ya tenía un usuario asignado distinto
        if (selectedValue && !map.has(selectedValue.toLowerCase())) {
            map.set(selectedValue.toLowerCase(), {
                username: selectedValue,
                label: selectedValue
            });
        }

        map.forEach(u => {
            const isMatch = selectedValue && (u.username.toLowerCase() === selectedValue.toLowerCase());
            html += `<option value="${u.username}" ${isMatch ? 'selected' : ''}>👤 ${u.label}</option>`;
        });

        select.innerHTML = html;
        if (selectedValue) {
            select.value = selectedValue;
        }
    }

    // Modal para pedir pieza extra (Jess)
    window.openAddExtraModal = function() {
        form.reset();
        document.getElementById('card-id').value = '';
        document.getElementById('card-desc').value = `Solicitado por: Jess\nMotivo / Detalle de la pieza extra: \n\nPrioridad: Urgente`;
        if (document.getElementById('card-status')) document.getElementById('card-status').value = 'Contenido Extra (Jess)';
        if (document.getElementById('card-priority')) document.getElementById('card-priority').value = 'Urgente';
        if (document.getElementById('card-tags')) document.getElementById('card-tags').value = 'Pieza Extra Jess';
        if(document.querySelector("#card-date")._flatpickr) {
            document.querySelector("#card-date")._flatpickr.clear();
        }
        
        // Reset preview
        document.getElementById('cover-preview').classList.add('hidden');
        document.getElementById('cover-preview').src = '';
        document.getElementById('cover-dropzone-text').innerText = 'Arrastra una imagen o clic aquí';

        deleteBtn.classList.add('hidden');
        if (sendAlertBtn) sendAlertBtn.classList.remove('hidden');
        modalTitle.innerHTML = '⚡ Nueva Pieza Extra (Jess)';
        setSocialNetworks('Instagram,TikTok');
        loadUsers();
        populateAssignedDropdown('gre'); // Sugerir a Grecia (CM) por defecto
        modal.classList.remove('hidden');
    };

    // Modal para programar publicación a partir de Fecha Especial
    window.openSpecialDateModal = function(title, dateStr, rec) {
        form.reset();
        document.getElementById('card-id').value = '';
        // Limpiar título de iconos para input
        const cleanTitle = title.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim();
        document.getElementById('card-title').value = cleanTitle;
        document.getElementById('card-desc').value = `Objetivo / Estrategia Recomendada:\n${rec}\n\n${defaultCopyTemplate}`;
        setSocialNetworks('Instagram,TikTok');
        if (document.getElementById('card-status')) document.getElementById('card-status').value = 'Ideas de Contenido';
        if (document.getElementById('card-priority')) document.getElementById('card-priority').value = 'Alta';
        if (document.getElementById('card-tags')) document.getElementById('card-tags').value = 'Fecha Especial Panamá';
        
        // Poner fecha en el selector flatpickr
        try {
            if (dateStr && document.querySelector("#card-date")._flatpickr) {
                const dt = new Date(`${dateStr}T12:00:00`);
                document.querySelector("#card-date")._flatpickr.setDate(dt);
            }
        } catch(e) {}

        // Reset preview
        document.getElementById('cover-preview').classList.add('hidden');
        document.getElementById('cover-preview').src = '';
        document.getElementById('cover-dropzone-text').innerText = 'Arrastra una imagen o clic aquí';

        deleteBtn.classList.add('hidden');
        if (sendAlertBtn) sendAlertBtn.classList.remove('hidden');
        modalTitle.innerHTML = '⭐ Programar Post de Fecha Especial';
        loadUsers();
        populateAssignedDropdown('gre'); // Sugerir a Grecia (CM)
        modal.classList.remove('hidden');
    };

    // Actualización de KPIs de Rendimiento para Admin
    function updateAdminKPIs() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentDay = now.getDate();

        // 1. Alerta de Entrega Obligatoria de Calendario el 15
        const deadlineEl = document.getElementById('kpi-calendar-deadline-alert');
        const deadlineTextEl = document.getElementById('kpi-deadline-text');
        if (deadlineEl && deadlineTextEl) {
            const daysLeft = 15 - currentDay;
            if (currentDay < 15) {
                deadlineEl.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-amber-950/40 border-amber-800/80 text-amber-300';
                deadlineTextEl.innerHTML = `📅 <strong>Entrega de Calendario:</strong> Faltan <strong>${daysLeft} días</strong> (Día 15)`;
            } else if (currentDay === 15) {
                deadlineEl.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-red-950/60 border-red-600 text-red-200 animate-pulse';
                deadlineTextEl.innerHTML = `🚨 <strong>¡HOY DÍA 15!</strong> Fecha límite para entrega de calendario mensual`;
            } else {
                deadlineEl.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-blue-950/40 border-blue-800/80 text-blue-300';
                deadlineTextEl.innerHTML = `✅ <strong>Día 15 superado:</strong> Próxima entrega: 15 de ${new Date(currentYear, currentMonth + 1, 1).toLocaleString('es-PA', { month: 'long' })}`;
            }
        }

        // 2. Publicaciones con fecha asignada en el mes actual
        const monthCards = allCards.filter(c => {
            if (!c.publish_date) return false;
            const d = new Date(c.publish_date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        const totalScheduled = monthCards.length;

        // Listas / Aprobadas (en Revisión o Recordatorio o con prioridad Listo)
        const readyCards = monthCards.filter(c => c.status === 'Revisión' || c.status === 'Recordatorio' || c.priority === 'Listo');
        
        // En Producción (Guión, Diseñar, Filmar, Editar)
        const inProgressCards = monthCards.filter(c => ['Redactar Guión-Copy', 'Diseñar', 'Filmar', 'Editar'].includes(c.status) || c.priority === 'En Desarrollo');

        // Piezas Extra solicitadas por Jess
        const jessExtras = allCards.filter(c => c.status === 'Contenido Extra (Jess)' || (c.tags && c.tags.toLowerCase().includes('jess')));

        const pct = totalScheduled > 0 ? Math.round((readyCards.length / totalScheduled) * 100) : 0;

        // Elementos DOM
        const pctEl = document.getElementById('kpi-month-percentage');
        const ratioEl = document.getElementById('kpi-month-ratio');
        const barEl = document.getElementById('kpi-progress-bar');
        const scheduledEl = document.getElementById('kpi-scheduled-count');
        const readyEl = document.getElementById('kpi-ready-count');
        const inProgEl = document.getElementById('kpi-in-progress-count');
        const extrasEl = document.getElementById('kpi-jess-extras-count');

        if (pctEl) pctEl.innerText = `${pct}%`;
        if (ratioEl) ratioEl.innerText = `(${readyCards.length}/${totalScheduled})`;
        if (barEl) barEl.style.width = `${pct}%`;
        if (scheduledEl) scheduledEl.innerText = totalScheduled;
        if (readyEl) readyEl.innerText = readyCards.length;
        if (inProgEl) inProgEl.innerText = inProgressCards.length;
        if (extrasEl) extrasEl.innerText = jessExtras.length;
    }
    window.updateAdminKPIs = updateAdminKPIs;

    // Initial fetch of users for assignments
    loadUsers();

});
