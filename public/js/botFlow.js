// ═══════════════════════════════════════════════════════════════
//  Flujo del Bot — tabs + tarjetas editables inline
//  Tabs: Diagrama | Especialidades | Cirugías | Estudios |
//        Laboratorio | Mensajes | Clínica | Promoción
// ═══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    let flowData = null;
    let activeTab = 'diagrama';
    let expandedCardId = null;

    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmtPrice = (n) => n == null ? '<span class="text-gray-500">—</span>' : `$${Number(n).toLocaleString('es-MX')}`;

    function toast(msg, type = 'info') {
        if (typeof window.showToast === 'function') {
            const label = type === 'error' ? 'Error' : type === 'success' ? 'Listo' : 'Info';
            window.showToast(label, msg, type === 'error' ? 'red' : type === 'success' ? 'green' : 'blue');
            return;
        }
        console.log(`[${type}]`, msg);
    }

    // Mermaid init (tema oscuro)
    if (window.mermaid) {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'loose',
            flowchart: { curve: 'basis', htmlLabels: true, padding: 20, nodeSpacing: 60, rankSpacing: 70, useMaxWidth: false },
            themeVariables: {
                primaryColor: '#0e1555',
                primaryTextColor: '#e5e7eb',
                primaryBorderColor: '#1e3a5f',
                lineColor: '#4ec3cd',
                tertiaryColor: '#070b2e',
                fontSize: '15px',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            },
        });
    }

    // ─────────────────────────────────────────
    //  Toggle de la vista principal
    // ─────────────────────────────────────────
    function showBotFlowView() {
        const crm = document.getElementById('crm-main-view');
        const parrilla = document.getElementById('parrilla-view');
        const view = document.getElementById('bot-flow-view');
        if (crm) crm.classList.add('hidden');
        if (parrilla) { parrilla.classList.add('hidden'); parrilla.classList.remove('flex'); }
        if (view) { view.classList.remove('hidden'); view.classList.add('flex'); }
        loadFlow();
    }
    function hideBotFlowView() {
        const view = document.getElementById('bot-flow-view');
        if (view) { view.classList.add('hidden'); view.classList.remove('flex'); }
    }

    // ─────────────────────────────────────────
    //  Fetch del flujo
    // ─────────────────────────────────────────
    async function loadFlow() {
        try {
            const res = await fetch('/api/bot/flow-mit');
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Error cargando flujo');
            flowData = json.data;
            renderTabs();
            renderActiveTab();
        } catch (err) {
            console.error(err);
            const container = document.getElementById('bot-flow-tab-content');
            if (container) container.innerHTML = `<div class="text-red-400 p-4 text-sm">Error: ${esc(err.message)}</div>`;
            toast('No se pudo cargar el flujo del bot', 'error');
        }
    }

    // ─────────────────────────────────────────
    //  Render de los tabs (chip activo)
    // ─────────────────────────────────────────
    function renderTabs() {
        document.querySelectorAll('.bftab').forEach(b => {
            const isActive = b.dataset.bftab === activeTab;
            b.classList.toggle('text-cyan-400', isActive);
            b.classList.toggle('border-cyan-400', isActive);
            b.classList.toggle('text-gray-400', !isActive);
            b.classList.toggle('border-transparent', !isActive);
        });
    }

    function renderActiveTab() {
        const container = document.getElementById('bot-flow-tab-content');
        if (!container || !flowData) return;
        if (activeTab === 'diagrama') return renderDiagramTab(container);
        if (activeTab === 'especialidades') return renderCatalogTab(container, 'especialidad', flowData.catalogo.especialidades, flowData.defaults.especialidades);
        if (activeTab === 'procedimientos') return renderCatalogTab(container, 'procedimiento', flowData.catalogo.procedimientos, flowData.defaults.procedimientos);
        if (activeTab === 'estudios') return renderCatalogTab(container, 'estudio', flowData.catalogo.estudios, flowData.defaults.estudios);
        if (activeTab === 'laboratorio') return renderCatalogTab(container, 'laboratorio', flowData.catalogo.laboratorio, flowData.defaults.laboratorio);
        if (activeTab === 'mensajes') return renderMensajesTab(container);
        if (activeTab === 'clinica') return renderClinicaTab(container);
        if (activeTab === 'promocion') return renderPromoTab(container);
    }

    // ═══════════════════════════════════════════════════════════════
    //  TAB: Diagrama (Mermaid solo con los 18 steps del flujo)
    // ═══════════════════════════════════════════════════════════════
    async function renderDiagramTab(container) {
        container.innerHTML = `
            <div class="bg-[#0a1230] border border-[#1e3a5f] rounded-xl p-3 sm:p-4">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div class="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs">
                        <span class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0e1555] border border-[#1e3a5f]"><span class="w-3 h-3 rounded-sm" style="background:#1e40af"></span> Inicio</span>
                        <span class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0e1555] border border-[#1e3a5f]"><span class="w-3 h-3 rounded-sm" style="background:#0ea5e9"></span> Menú</span>
                        <span class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0e1555] border border-[#1e3a5f]"><span class="w-3 h-3 rounded-sm" style="background:#10b981"></span> Info</span>
                        <span class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0e1555] border border-[#1e3a5f]"><span class="w-3 h-3 rounded-sm" style="background:#eab308"></span> Captura</span>
                        <span class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0e1555] border border-[#1e3a5f]"><span class="w-3 h-3 rounded-sm" style="background:#22c55e"></span> Cierre venta</span>
                        <span class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0e1555] border border-[#1e3a5f]"><span class="w-3 h-3 rounded-sm" style="background:#64748b"></span> Cierre frío</span>
                        <span class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0e1555] border border-[#1e3a5f]"><span class="w-3 h-3 rounded-sm" style="background:#a855f7"></span> Escalar</span>
                        <span class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0e1555] border border-[#1e3a5f]"><span class="w-3 h-3 rounded-sm" style="background:#ef4444"></span> Alerta</span>
                    </div>
                </div>
                <div class="bg-[#050820] rounded-lg border border-[#1e3a5f]/60 p-4 overflow-auto custom-scrollbar" style="max-height:72vh;">
                    <div id="bot-flow-diagram" class="min-w-fit"></div>
                </div>
                <p class="mt-3 text-xs text-gray-500 flex items-center gap-1.5">
                    <i class='bx bx-info-circle text-base'></i>
                    Este diagrama muestra solo el camino que recorre la conversación. Para editar precios, horarios o mensajes, usa las otras pestañas.
                </p>
            </div>
        `;

        if (!window.mermaid) {
            document.getElementById('bot-flow-diagram').innerHTML = '<div class="text-red-400 p-4">Mermaid no cargó</div>';
            return;
        }

        const source = buildSimpleMermaid(flowData.flujo);
        try {
            const { svg } = await mermaid.render('bfd-' + Date.now(), source);
            document.getElementById('bot-flow-diagram').innerHTML = svg;
        } catch (err) {
            console.error('Mermaid error:', err);
            document.getElementById('bot-flow-diagram').innerHTML = `<pre class="text-red-400 text-xs whitespace-pre-wrap">${esc(err.message)}</pre>`;
        }
    }

    function buildSimpleMermaid(flujo) {
        const lines = ['flowchart TD'];
        const edgeLabel = (s) => `"${String(s || '').replace(/["«»<>]/g, '')}"`;

        for (const n of flujo.nodos) {
            // Quitamos \n y limitamos ancho para que el texto no se descuadre
            const titulo = String(n.titulo || '').replace(/["<>]/g, '');
            const lbl = `${titulo}<br/><span style='font-size:11px;opacity:.65'>step ${n.step}</span>`;
            let shape;
            if (n.tipo === 'inicio')             shape = `(["${lbl}"])`;
            else if (n.tipo === 'menu')          shape = `[["${lbl}"]]`;
            else if (n.tipo === 'info')          shape = `["${lbl}"]`;
            else if (n.tipo === 'captura')       shape = `[/"${lbl}"/]`;
            else if (n.tipo === 'cierre')        shape = `(("${lbl}"))`;
            else if (n.tipo === 'cierre_frio')   shape = `(("${lbl}"))`;
            else if (n.tipo === 'escalar')       shape = `{"${lbl}"}`;
            else if (n.tipo === 'alerta')        shape = `{{"${lbl}"}}`;
            else                                  shape = `["${lbl}"]`;
            lines.push(`${n.id}${shape}`);
            lines.push(`class ${n.id} tipo_${n.tipo}`);
        }

        for (const a of flujo.aristas) {
            lines.push(`${a.from} -->|${edgeLabel(a.label)}| ${a.to}`);
        }

        lines.push(`classDef tipo_inicio fill:#1e40af,stroke:#60a5fa,color:#fff,stroke-width:2px`);
        lines.push(`classDef tipo_menu fill:#0ea5e9,stroke:#38bdf8,color:#fff,stroke-width:2px`);
        lines.push(`classDef tipo_info fill:#10b981,stroke:#34d399,color:#042f2e,stroke-width:2px`);
        lines.push(`classDef tipo_captura fill:#eab308,stroke:#fde047,color:#422006,stroke-width:2px`);
        lines.push(`classDef tipo_cierre fill:#22c55e,stroke:#4ade80,color:#052e16,stroke-width:2px`);
        lines.push(`classDef tipo_cierre_frio fill:#64748b,stroke:#94a3b8,color:#fff,stroke-width:2px`);
        lines.push(`classDef tipo_escalar fill:#a855f7,stroke:#c084fc,color:#fff,stroke-width:2px`);
        lines.push(`classDef tipo_alerta fill:#ef4444,stroke:#fca5a5,color:#fff,stroke-width:2px`);
        return lines.join('\n');
    }

    // ═══════════════════════════════════════════════════════════════
    //  TAB: Catálogo genérico (especialidad/procedimiento/lab/estudio)
    // ═══════════════════════════════════════════════════════════════
    const FIELDS = {
        especialidad: [
            { k: 'costo', label: 'Costo total (MXN)', type: 'number', hint: 'Vacío = "lo confirma un asesor".' },
            { k: 'anticipo', label: 'Anticipo (MXN)', type: 'number' },
            { k: 'resto', label: 'Resto en la cita (MXN)', type: 'number' },
            { k: 'horario', label: 'Horario', type: 'text' },
            { k: 'nota', label: 'Nota adicional', type: 'textarea' },
            { k: 'asesorConfirma', label: 'Texto "asesor confirma..."', type: 'text', hint: 'Solo si el precio NO es fijo.' },
        ],
        procedimiento: [
            { k: 'desde', label: 'Precio "desde" (texto)', type: 'text', hint: 'Ej: $47,999' },
        ],
        laboratorio: [
            { k: 'precio', label: 'Precio (MXN)', type: 'number' },
            { k: 'nota', label: 'Nota (opcional)', type: 'text' },
        ],
        estudio: [
            { k: 'costo', label: 'Costo total (MXN)', type: 'number' },
            { k: 'anticipo', label: 'Anticipo (MXN)', type: 'number' },
            { k: 'resto', label: 'Resto (MXN)', type: 'number' },
            { k: 'desc', label: 'Descripción corta', type: 'text' },
        ],
    };

    function isItemEdited(item, def, fields) {
        return fields.some(f => {
            const a = item[f.k], b = def[f.k];
            if (a == null && b == null) return false;
            return a !== b;
        });
    }

    function priceBadge(item, tipo) {
        if (tipo === 'procedimiento') return item.desde ? `<span class="font-mono text-cyan-300">desde ${esc(item.desde)}</span>` : '<span class="text-gray-500">sin precio</span>';
        if (tipo === 'laboratorio')   return `<span class="font-mono text-cyan-300">${fmtPrice(item.precio)}</span>`;
        // Especialidad y estudio: costo
        if (item.costo != null) return `<span class="font-mono text-cyan-300">${fmtPrice(item.costo)}</span>`;
        if (item.asesorConfirma) return `<span class="text-yellow-300 text-xs">asesor confirma</span>`;
        return '<span class="text-gray-500">sin precio</span>';
    }

    function renderCatalogTab(container, tipo, liveArr, defArr) {
        const fields = FIELDS[tipo];
        const titleMap = {
            especialidad: { icon: 'bx-plus-medical', title: 'Especialidades', hint: 'Edita precios, anticipos y horarios de cada consulta con especialista.' },
            procedimiento: { icon: 'bx-shape-circle', title: 'Cirugías y procedimientos', hint: 'Precio "desde" que el bot muestra para cada cirugía.' },
            estudio:       { icon: 'bx-test-tube', title: 'Estudios con cita', hint: 'Estudios que requieren agendarse (Doppler, Holter, MAPA, Eco, Endoscopía).' },
            laboratorio:   { icon: 'bx-droplet', title: 'Laboratorio clínico', hint: 'Servicios sin cita que se pagan directamente en la clínica.' },
        };
        const t = titleMap[tipo];

        container.innerHTML = `
            <div class="mb-3">
                <h3 class="text-lg font-bold text-white flex items-center gap-2"><i class='bx ${t.icon} text-cyan-400'></i> ${t.title}</h3>
                <p class="text-xs text-gray-400 mt-0.5">${t.hint} Click en una tarjeta para editarla.</p>
            </div>
            <div id="bf-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"></div>
        `;

        const grid = container.querySelector('#bf-grid');
        for (const item of liveArr) {
            const def = defArr.find(d => d.id === item.id) || item;
            const edited = isItemEdited(item, def, fields);
            const emoji = item.emoji || '';
            const nombre = item.nombre || item.id;
            const isExpanded = expandedCardId === `${tipo}:${item.id}`;

            const card = document.createElement('div');
            card.className = `bg-[#0a1230] border rounded-xl overflow-hidden transition-all ${isExpanded ? 'border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.3)]' : 'border-[#1e3a5f] hover:border-[#4ec3cd]/50'}`;

            // Header de la tarjeta (siempre visible)
            const headerHtml = `
                <button type="button" class="bf-card-head w-full text-left p-3 sm:p-4 flex items-start justify-between gap-2 cursor-pointer hover:bg-[#0e1555]/50 transition-colors">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-xl leading-none">${esc(emoji)}</span>
                            <span class="font-semibold text-white truncate">${esc(nombre)}</span>
                            ${edited ? '<span class="text-[9px] uppercase font-bold tracking-wider bg-yellow-950/60 text-yellow-300 border border-yellow-800 rounded px-1.5 py-0.5">editado</span>' : ''}
                        </div>
                        <div class="text-xs text-gray-400 flex items-center gap-3 flex-wrap">
                            ${priceBadge(item, tipo)}
                            ${item.horario ? `<span class="flex items-center gap-1"><i class='bx bx-time'></i> ${esc(item.horario)}</span>` : ''}
                            ${item.area ? `<span class="text-[10px] uppercase tracking-wider bg-[#0e1555] border border-[#1e3a5f] rounded px-1.5 py-0.5">${esc(item.area)}</span>` : ''}
                        </div>
                    </div>
                    <i class='bx ${isExpanded ? 'bx-chevron-up' : 'bx-chevron-down'} text-xl text-gray-400 shrink-0'></i>
                </button>
            `;

            let editorHtml = '';
            if (isExpanded) {
                editorHtml = `
                    <div class="border-t border-[#1e3a5f] bg-[#070b2e]/60 p-3 sm:p-4 space-y-3">
                        ${fields.map(f => {
                            const val = item[f.k] == null ? '' : item[f.k];
                            const defVal = def[f.k] == null ? '—' : def[f.k];
                            const input = f.type === 'textarea'
                                ? `<textarea data-k="${f.k}" rows="2" class="w-full bg-[#050820] border border-[#1e3a5f] rounded-md px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-400">${esc(val)}</textarea>`
                                : `<input data-k="${f.k}" type="${f.type}" value="${esc(val)}" class="w-full bg-[#050820] border border-[#1e3a5f] rounded-md px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-400">`;
                            return `
                                <div>
                                    <div class="flex items-baseline justify-between mb-1">
                                        <label class="text-[11px] uppercase tracking-wider text-gray-400 font-bold">${esc(f.label)}</label>
                                        <span class="text-[10px] text-gray-500" title="Valor de fábrica">fábrica: ${esc(defVal)}</span>
                                    </div>
                                    ${input}
                                    ${f.hint ? `<p class="text-[10px] text-gray-500 mt-0.5">${esc(f.hint)}</p>` : ''}
                                </div>
                            `;
                        }).join('')}
                        <div class="flex items-center gap-2 pt-2">
                            <button class="bf-save flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2">
                                <i class='bx bx-save'></i> Guardar
                            </button>
                            ${edited ? `<button class="bf-reset px-3 py-2 border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/50 rounded-md text-xs font-semibold transition-colors" title="Restaurar fábrica"><i class='bx bx-reset'></i> Fábrica</button>` : ''}
                        </div>
                    </div>
                `;
            }

            card.innerHTML = headerHtml + editorHtml;
            grid.appendChild(card);

            // Wire
            const head = card.querySelector('.bf-card-head');
            head.addEventListener('click', () => {
                const key = `${tipo}:${item.id}`;
                expandedCardId = expandedCardId === key ? null : key;
                renderActiveTab();
            });

            if (isExpanded) {
                card.querySelector('.bf-save').addEventListener('click', async () => {
                    const patch = {};
                    card.querySelectorAll('[data-k]').forEach(el => {
                        const k = el.dataset.k;
                        let v = el.value;
                        if (el.type === 'number') v = (v === '' ? null : Number(v));
                        else if (v === '') v = null;
                        patch[k] = v;
                    });
                    await saveNode(tipo, item.id, patch);
                });
                const rb = card.querySelector('.bf-reset');
                if (rb) rb.addEventListener('click', () => resetNode(tipo, item.id));
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  TAB: Mensajes
    // ═══════════════════════════════════════════════════════════════
    function renderMensajesTab(container) {
        const mensajes = [
            { k: 'SALUDO_MENU', titulo: 'Saludo + menú principal', desc: 'Primer mensaje que recibe el cliente al escribir "hola" o un saludo.' },
            { k: 'PEDIR_NOMBRE', titulo: 'Pedir nombre para agendar', desc: 'Cuando el cliente dice "sí" a agendar una consulta con especialista.' },
            { k: 'PEDIR_NOMBRE_VALORACION', titulo: 'Pedir nombre para valoración (cirugías)', desc: 'Cuando el cliente dice "sí" a agendar valoración de una cirugía.' },
            { k: 'PEDIR_NOMBRE_ESTUDIO', titulo: 'Pedir nombre para estudio', desc: 'Cuando el cliente dice "sí" a agendar un estudio con cita.' },
            { k: 'CIERRE_VENTA', titulo: 'Cierre con venta', desc: 'Mensaje final cuando el cliente completó día + horario. Se pasa a asesor humano.' },
            { k: 'CIERRE_SIN_VENTA', titulo: 'Cierre sin venta', desc: 'Cuando el cliente rechaza por precio o cambia de opinión.' },
            { k: 'CIERRE_SIN_VENTA_DISTANCIA', titulo: 'Cierre sin venta (distancia)', desc: 'Cuando el cliente dice que le queda lejos.' },
            { k: 'ESCALAR_ASESOR', titulo: 'Escalar a asesor humano', desc: 'Cuando el cliente pide hablar con una persona (opción 5 o "asesor").' },
            { k: 'EMERGENCIA', titulo: 'Emergencia médica', desc: 'Detectada por palabras como "emergencia", "no puedo respirar", "dolor fuerte en el pecho".' },
            { k: 'CRISIS', titulo: 'Crisis emocional', desc: 'Detectada por menciones de suicidio o autolesión. Dirige a Línea de la Vida 800 911 2000.' },
        ];

        container.innerHTML = `
            <div class="mb-3">
                <h3 class="text-lg font-bold text-white flex items-center gap-2"><i class='bx bx-message-rounded-dots text-cyan-400'></i> Mensajes del bot</h3>
                <p class="text-xs text-gray-400 mt-0.5">Los textos exactos que envía el bot. Formato WhatsApp: *negrita*, _cursiva_. Enter = salto de línea.</p>
            </div>
            <div id="bf-msgs" class="space-y-3"></div>
        `;
        const wrap = container.querySelector('#bf-msgs');

        for (const m of mensajes) {
            const current = (flowData.catalogo.mensajes[m.k] || '').trim();
            const def = (flowData.defaults.mensajes[m.k] || '').trim();
            const edited = current !== def;
            const isExpanded = expandedCardId === `mensaje:${m.k}`;

            const card = document.createElement('div');
            card.className = `bg-[#0a1230] border rounded-xl overflow-hidden transition-all ${isExpanded ? 'border-cyan-400' : 'border-[#1e3a5f] hover:border-[#4ec3cd]/50'}`;

            const preview = current.length > 120 ? current.slice(0, 120) + '…' : current;
            card.innerHTML = `
                <button type="button" class="bf-card-head w-full text-left p-3 sm:p-4 flex items-start justify-between gap-2 hover:bg-[#0e1555]/50 transition-colors">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-semibold text-white">${esc(m.titulo)}</span>
                            ${edited ? '<span class="text-[9px] uppercase font-bold tracking-wider bg-yellow-950/60 text-yellow-300 border border-yellow-800 rounded px-1.5 py-0.5">editado</span>' : ''}
                            <span class="text-[10px] font-mono text-gray-500">${esc(m.k)}</span>
                        </div>
                        <p class="text-xs text-gray-400 mb-2">${esc(m.desc)}</p>
                        <div class="text-sm text-gray-300 bg-[#070b2e] border border-[#1e3a5f] rounded p-2 whitespace-pre-wrap">${esc(preview)}</div>
                    </div>
                    <i class='bx ${isExpanded ? 'bx-chevron-up' : 'bx-chevron-down'} text-xl text-gray-400 shrink-0'></i>
                </button>
                ${isExpanded ? `
                    <div class="border-t border-[#1e3a5f] bg-[#070b2e]/60 p-3 sm:p-4 space-y-3">
                        <div>
                            <label class="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Texto exacto que envía el bot</label>
                            <textarea class="bf-msg-text mt-1 w-full bg-[#050820] border border-[#1e3a5f] rounded-md p-3 text-sm text-gray-200 focus:outline-none focus:border-cyan-400 font-mono" rows="8">${esc(current)}</textarea>
                        </div>
                        ${edited ? `
                        <details class="text-xs">
                            <summary class="text-gray-500 cursor-pointer hover:text-gray-300">Ver texto de fábrica</summary>
                            <pre class="mt-2 bg-black/40 border border-[#1e3a5f] rounded p-2 text-gray-400 whitespace-pre-wrap text-xs">${esc(def)}</pre>
                        </details>
                        ` : ''}
                        <div class="flex items-center gap-2 pt-1">
                            <button class="bf-save flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2">
                                <i class='bx bx-save'></i> Guardar
                            </button>
                            ${edited ? `<button class="bf-reset px-3 py-2 border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/50 rounded-md text-xs font-semibold transition-colors"><i class='bx bx-reset'></i> Fábrica</button>` : ''}
                        </div>
                    </div>
                ` : ''}
            `;
            wrap.appendChild(card);

            card.querySelector('.bf-card-head').addEventListener('click', () => {
                const key = `mensaje:${m.k}`;
                expandedCardId = expandedCardId === key ? null : key;
                renderActiveTab();
            });

            if (isExpanded) {
                card.querySelector('.bf-save').addEventListener('click', async () => {
                    const txt = card.querySelector('.bf-msg-text').value;
                    await saveNode('mensaje', null, { [m.k]: txt });
                });
                const rb = card.querySelector('.bf-reset');
                if (rb) rb.addEventListener('click', () => resetNodeKey('mensaje', m.k));
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  TAB: Clínica
    // ═══════════════════════════════════════════════════════════════
    function renderClinicaTab(container) {
        const c = flowData.catalogo.clinica;
        const def = flowData.defaults.clinica;
        const fields = [
            { k: 'direccion', label: 'Dirección completa' },
            { k: 'whatsapp', label: 'WhatsApp' },
            { k: 'email', label: 'Email' },
            { k: 'web', label: 'Página web' },
            { k: 'horario', label: 'Horario' },
            { k: 'maps', label: 'URL de Google Maps' },
        ];
        const edited = fields.some(f => c[f.k] !== def[f.k]);
        container.innerHTML = `
            <div class="mb-3">
                <h3 class="text-lg font-bold text-white flex items-center gap-2"><i class='bx bx-map text-cyan-400'></i> Datos de la clínica</h3>
                <p class="text-xs text-gray-400 mt-0.5">Información que el bot envía cuando el cliente elige "Ubicación y horarios".</p>
            </div>
            <div class="bg-[#0a1230] border border-[#1e3a5f] rounded-xl p-4 sm:p-5 space-y-3 max-w-2xl">
                ${edited ? '<div class="bg-yellow-950/30 border border-yellow-800/50 rounded-md p-2 text-xs text-yellow-200"><i class="bx bx-edit mr-1"></i>Hay campos editados.</div>' : ''}
                ${fields.map(f => `
                    <div>
                        <label class="text-[11px] uppercase tracking-wider text-gray-400 font-bold">${esc(f.label)}</label>
                        <input data-k="${f.k}" type="text" value="${esc(c[f.k] || '')}" class="mt-1 w-full bg-[#050820] border border-[#1e3a5f] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-400">
                    </div>
                `).join('')}
                <div class="flex items-center gap-2 pt-2">
                    <button id="bf-clinica-save" class="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2">
                        <i class='bx bx-save'></i> Guardar cambios
                    </button>
                    ${edited ? `<button id="bf-clinica-reset" class="px-3 py-2 border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/50 rounded-md text-xs font-semibold transition-colors"><i class='bx bx-reset'></i> Fábrica</button>` : ''}
                </div>
            </div>
        `;
        container.querySelector('#bf-clinica-save').addEventListener('click', async () => {
            const patch = {};
            container.querySelectorAll('[data-k]').forEach(el => { patch[el.dataset.k] = el.value; });
            await saveNode('clinica', null, patch);
        });
        const rb = container.querySelector('#bf-clinica-reset');
        if (rb) rb.addEventListener('click', () => resetNode('clinica', null));
    }

    // ═══════════════════════════════════════════════════════════════
    //  TAB: Promoción
    // ═══════════════════════════════════════════════════════════════
    function renderPromoTab(container) {
        const p = flowData.catalogo.promocion;
        const def = flowData.defaults.promocion;
        const edited = JSON.stringify(p) !== JSON.stringify(def);
        const activa = flowData.promocion_activa && flowData.promocion_activa.activa;

        container.innerHTML = `
            <div class="mb-3">
                <h3 class="text-lg font-bold text-white flex items-center gap-2"><i class='bx bx-gift text-cyan-400'></i> Promoción vigente</h3>
                <p class="text-xs text-gray-400 mt-0.5">El bot muestra este mensaje adicional cuando el cliente pregunta por el procedimiento al que aplica la promo.</p>
            </div>
            <div class="bg-[#0a1230] border border-[#1e3a5f] rounded-xl p-4 sm:p-5 space-y-3 max-w-2xl">
                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold ${activa ? 'bg-green-950/50 text-green-300 border border-green-800' : 'bg-gray-900 text-gray-400 border border-gray-700'}">
                    <span class="w-2 h-2 rounded-full ${activa ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}"></span>
                    ${activa ? 'ACTIVA — el bot la está mostrando' : 'EXPIRADA — el bot no la muestra'}
                </div>
                ${edited ? '<div class="bg-yellow-950/30 border border-yellow-800/50 rounded-md p-2 text-xs text-yellow-200"><i class="bx bx-edit mr-1"></i>Promoción editada.</div>' : ''}
                <div>
                    <label class="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Vigente hasta</label>
                    <input data-k="activa_hasta" type="text" value="${esc(p.activa_hasta || '')}" class="mt-1 w-full bg-[#050820] border border-[#1e3a5f] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-400" placeholder="2026-11-30T23:59:59">
                    <p class="text-[10px] text-gray-500 mt-0.5">Formato ISO: YYYY-MM-DDTHH:MM:SS</p>
                </div>
                <div>
                    <label class="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Texto que envía el bot</label>
                    <textarea data-k="texto" rows="4" class="mt-1 w-full bg-[#050820] border border-[#1e3a5f] rounded-md p-3 text-sm text-gray-200 focus:outline-none focus:border-cyan-400 font-mono">${esc(p.texto || '')}</textarea>
                </div>
                <div>
                    <label class="text-[11px] uppercase tracking-wider text-gray-400 font-bold">ID del procedimiento al que aplica</label>
                    <input data-k="aplica_a_procedimiento_id" type="text" value="${esc(p.aplica_a_procedimiento_id || '')}" class="mt-1 w-full bg-[#050820] border border-[#1e3a5f] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-400" placeholder="orquidopexia">
                    <p class="text-[10px] text-gray-500 mt-0.5">Ej: orquidopexia, rinoplastia, mommy_makeover, etc.</p>
                </div>
                <div class="flex items-center gap-2 pt-2">
                    <button id="bf-promo-save" class="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2">
                        <i class='bx bx-save'></i> Guardar promoción
                    </button>
                    ${edited ? `<button id="bf-promo-reset" class="px-3 py-2 border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/50 rounded-md text-xs font-semibold transition-colors"><i class='bx bx-reset'></i> Fábrica</button>` : ''}
                </div>
            </div>
        `;
        container.querySelector('#bf-promo-save').addEventListener('click', async () => {
            const patch = {};
            container.querySelectorAll('[data-k]').forEach(el => { patch[el.dataset.k] = el.value; });
            await saveNode('promocion', null, patch);
        });
        const rb = container.querySelector('#bf-promo-reset');
        if (rb) rb.addEventListener('click', () => resetNode('promocion', null));
    }

    // ═══════════════════════════════════════════════════════════════
    //  Save / Reset
    // ═══════════════════════════════════════════════════════════════
    async function saveNode(tipo, id, patch) {
        try {
            const res = await fetch('/api/bot/flow-mit/node', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo, id, patch }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Error guardando');
            toast('Guardado. El bot ya usa los nuevos valores.', 'success');
            await loadFlow();
        } catch (err) {
            toast('No se pudo guardar: ' + err.message, 'error');
        }
    }

    async function resetNode(tipo, id) {
        if (!confirm('¿Restaurar a valores de fábrica?')) return;
        try {
            const res = await fetch('/api/bot/flow-mit/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo, id }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Error restaurando');
            toast('Restaurado.', 'success');
            await loadFlow();
        } catch (err) {
            toast('No se pudo restaurar: ' + err.message, 'error');
        }
    }

    // Resetea solo UNA clave de un bloque (ej. un mensaje específico sin tocar los demás).
    async function resetNodeKey(tipo, key) {
        if (!confirm('¿Restaurar este mensaje a fábrica?')) return;
        try {
            // Para mensajes: resetear la clave específica requiere PUT con el default.
            // Más simple: obtener el default y guardarlo como "override = default" → vuelve a fábrica.
            const def = flowData.defaults.mensajes[key];
            await saveNode('mensaje', null, { [key]: def });
        } catch (err) {
            toast('No se pudo restaurar: ' + err.message, 'error');
        }
    }

    async function resetAll() {
        if (!confirm('⚠️ Esto descarta TODAS las ediciones del flujo y vuelve al catálogo de fábrica.\n\n¿Continuar?')) return;
        try {
            const res = await fetch('/api/bot/flow-mit/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Error restaurando');
            toast('Flujo restaurado a fábrica.', 'success');
            await loadFlow();
        } catch (err) {
            toast('No se pudo restaurar: ' + err.message, 'error');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Bootstrap
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('bot-flow-btn');
        if (!btn) return;

        btn.addEventListener('click', showBotFlowView);
        document.querySelectorAll('.brand-btn').forEach(b => b.addEventListener('click', hideBotFlowView));
        const mc = document.getElementById('my-clients-btn');
        if (mc) mc.addEventListener('click', hideBotFlowView);
        const pb = document.getElementById('parrilla-btn');
        if (pb) pb.addEventListener('click', hideBotFlowView);

        const rl = document.getElementById('bot-flow-reload');
        if (rl) rl.addEventListener('click', loadFlow);
        const ra = document.getElementById('bot-flow-reset-all');
        if (ra) ra.addEventListener('click', resetAll);

        // Click en subtab
        document.querySelectorAll('.bftab').forEach(b => {
            b.addEventListener('click', () => {
                activeTab = b.dataset.bftab;
                expandedCardId = null;
                renderTabs();
                renderActiveTab();
            });
        });
    });
})();
