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
            b.classList.toggle('active', isActive);
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

    // Mapeo step → clave del mensaje que envía el bot (para el modal de preview)
    const STEP_TO_MENSAJE = {
        step_1: 'SALUDO_MENU',
        cierre_venta: 'CIERRE_VENTA',
        cierre_sin_venta: 'CIERRE_SIN_VENTA',
        cierre_distancia: 'CIERRE_SIN_VENTA_DISTANCIA',
        escalar_asesor: 'ESCALAR_ASESOR',
        emergencia: 'EMERGENCIA',
        crisis: 'CRISIS',
        step_70: 'PEDIR_NOMBRE',
    };

    // Texto generado dinámicamente por el bot para pasos que no son un mensaje fijo
    function getDynamicStepText(stepId) {
        if (!flowData) return null;
        const c = flowData.catalogo;
        if (stepId === 'step_10') {
            let t = '📋 *Nuestras especialidades*\n\nEscribe el *número*:\n\n';
            c.especialidades.forEach((e, i) => { t += `${i + 1}. ${e.emoji} ${e.nombre}\n`; });
            t += '\n0️⃣ Volver al menú';
            return t;
        }
        if (stepId === 'step_20') {
            let t = '✨ *Cirugía y procedimientos*\n\n*Cirugía plástica y estética:*\n';
            c.procedimientos.filter(p => p.cat === 'estetica').forEach((p, i) => { t += `${i + 1}. ${p.nombre} — desde ${p.desde}\n`; });
            t += '\n*Cirugía pediátrica y hernias:*\n';
            c.procedimientos.filter(p => p.cat !== 'estetica').forEach((p, i) => { t += `${i + 5}. ${p.nombre} — desde ${p.desde}\n`; });
            if (flowData.promocion_activa && flowData.promocion_activa.activa) t += `\n${flowData.promocion_activa.texto}\n`;
            t += '\n_Todos requieren valoración previa ($700, anticipo $200). El costo final puede aumentar según la complejidad._\n\nEscribe el *número* del procedimiento o *0* para volver.';
            return t;
        }
        if (stepId === 'step_30') {
            let t = '🔬 *Laboratorio y estudios*\n\n*Laboratorio clínico (sin cita):*\n';
            c.laboratorio.forEach(l => { t += `• ${l.nombre}: *$${l.precio} MXN*${l.nota ? ` (${l.nota})` : ''}\n`; });
            t += '\n_Se pagan directamente en la clínica. Las indicaciones de preparación las confirma un asesor._\n';
            t += '\n*Estudios con cita:*\n';
            c.estudios.forEach((e, i) => { t += `${i + 1}. ${e.nombre}${e.costo ? ` — $${e.costo.toLocaleString()}` : ' — precio con asesor'}\n`; });
            t += '\nEscribe el *número* del estudio para más detalle, o *0* para volver.';
            return t;
        }
        if (stepId === 'step_40') {
            return `📍 *MIT Medical Tower*\n\n🏢 ${c.clinica.direccion}\n🕐 Horario: ${c.clinica.horario}\n📞 WhatsApp: ${c.clinica.whatsapp}\n📧 ${c.clinica.email || 'mitmedicalt@yahoo.com'}\n🌐 ${c.clinica.web}\n\n📌 Google Maps:\n${c.clinica.maps}`;
        }
        if (stepId === 'step_11') {
            return '— Se arma dinámicamente por especialidad —\n\nEjemplo con Urología:\n\n🩺 *Urología*\n\n💰 Costo total: *$800 MXN*\n• Anticipo para apartar: *$200*\n• Resto el día de tu cita: *$600*\n🕐 Horario: Lunes, miércoles y sábado, de 10:00 am a 12:00 pm.\n\n¿Te gustaría agendar tu cita?\n\n_Cambia los valores desde la pestaña "Especialidades"._';
        }
        if (stepId === 'step_21') {
            return '— Se arma dinámicamente por procedimiento —\n\nEjemplo con Rinoplastia:\n\n✨ *Rinoplastia ultrasónica*\n\nPrecio desde *$47,999 MXN*.\n_El costo final se confirma en una valoración con el cirujano, que cuesta $700 con $200 de anticipo._\n\n¿Te gustaría agendar la valoración?\n\n_Cambia los valores desde la pestaña "Cirugías"._';
        }
        if (stepId === 'step_32') {
            return '— Se arma dinámicamente por estudio —\n\nEjemplo con Holter:\n\n🔬 *Holter* (Cardiología)\n\nmonitoreo del ritmo del corazón\n💰 Costo total: *$1,500 MXN*\n• Anticipo: *$500*\n• Resto: *$1,000*\n\n¿Te gustaría agendar este estudio?\n\n_Cambia los valores desde la pestaña "Estudios"._';
        }
        if (stepId === 'step_71') {
            return '— Mensaje generado dinámicamente —\n\nGracias por la información. ¿Qué *día y horario* prefieres?\n\n_Se añade el horario de la especialidad si aplica._';
        }
        if (stepId === 'step_72') {
            return '— El bot pregunta día/horario, y al recibirlo envía el CIERRE CON VENTA —\n\nGracias, [Nombre]. ¿Qué *día y horario* prefieres para tu cita?';
        }
        if (stepId === 'step_0') {
            return '— Paso inicial —\n\nEl bot analiza el primer mensaje del cliente y decide a dónde llevarlo:\n\n• Si saluda ("hola") → envía el MENÚ PRINCIPAL\n• Si menciona una especialidad → va directo a INFO DE ESPECIALIDAD\n• Si menciona un procedimiento → va a INFO DE PROCEDIMIENTO\n• Si menciona un síntoma → sugiere la especialidad adecuada\n• Si es emergencia → ALERTA DE EMERGENCIA\n• Si es crisis emocional → LÍNEA DE LA VIDA';
        }
        return null;
    }

    async function renderDiagramTab(container) {
        const legend = [
            { c: '#1e3a8a', t: 'Inicio' },
            { c: '#0e4a60', t: 'Menú' },
            { c: '#064e3b', t: 'Info' },
            { c: '#713f12', t: 'Captura' },
            { c: '#166534', t: 'Cierre venta' },
            { c: '#334155', t: 'Cierre frío' },
            { c: '#4c1d95', t: 'Escalar' },
            { c: '#991b1b', t: 'Alerta' },
        ];
        container.innerHTML = `
            <div class="bf-panel p-4 sm:p-5">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
                        ${legend.map(l => `<span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#050820] border border-[#1e3a5f] text-gray-300"><span class="w-2.5 h-2.5 rounded-full" style="background:${l.c}"></span>${l.t}</span>`).join('')}
                    </div>
                    <div class="text-[11px] text-gray-400 flex items-center gap-1.5 bg-[rgba(78,195,205,0.08)] border border-[rgba(78,195,205,0.25)] rounded-full px-3 py-1">
                        <i class='bx bx-mouse-alt text-base text-[#4ec3cd]'></i> Click en un nodo — arrastra para mover
                    </div>
                </div>
                <div id="bot-flow-diagram-wrap" class="bg-[#050820] rounded-xl border border-[#1e3a5f] p-5 overflow-auto custom-scrollbar select-none cursor-grab" style="max-height:72vh;">
                    <div id="bot-flow-diagram" class="min-w-fit"></div>
                </div>
            </div>
        `;

        if (!window.mermaid) {
            document.getElementById('bot-flow-diagram').innerHTML = '<div class="text-red-400 p-4">Mermaid no cargó</div>';
            return;
        }

        const source = buildSimpleMermaid(flowData.flujo);
        try {
            const { svg, bindFunctions } = await mermaid.render('bfd-' + Date.now(), source);
            const diagram = document.getElementById('bot-flow-diagram');
            diagram.innerHTML = svg;
            if (bindFunctions) bindFunctions(diagram);
            wireDragToPan(document.getElementById('bot-flow-diagram-wrap'));
            // Cursor pointer en los nodos clicables
            diagram.querySelectorAll('g.node').forEach(g => { g.style.cursor = 'pointer'; });
        } catch (err) {
            console.error('Mermaid error:', err);
            document.getElementById('bot-flow-diagram').innerHTML = `<pre class="text-red-400 text-xs whitespace-pre-wrap">${esc(err.message)}</pre>`;
        }
    }

    function buildSimpleMermaid(flujo) {
        const lines = ['flowchart TD'];
        const edgeLabel = (s) => `"${String(s || '').replace(/["«»<>]/g, '')}"`;

        for (const n of flujo.nodos) {
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
            // Click handler: cada nodo abre el modal con su mensaje
            lines.push(`click ${n.id} call window.__bfNodeClick("${n.id}")`);
        }

        for (const a of flujo.aristas) {
            lines.push(`${a.from} -->|${edgeLabel(a.label)}| ${a.to}`);
        }

        // Paleta MIT: navy base + teal #4ec3cd como acento de marca
        lines.push(`classDef tipo_inicio fill:#1e3a8a,stroke:#4ec3cd,color:#fff,stroke-width:2.5px`);
        lines.push(`classDef tipo_menu fill:#0e4a60,stroke:#4ec3cd,color:#e0f7fa,stroke-width:2.5px`);
        lines.push(`classDef tipo_info fill:#064e3b,stroke:#34d399,color:#d1fae5,stroke-width:2.5px`);
        lines.push(`classDef tipo_captura fill:#713f12,stroke:#fbbf24,color:#fef3c7,stroke-width:2.5px`);
        lines.push(`classDef tipo_cierre fill:#166534,stroke:#4ade80,color:#dcfce7,stroke-width:2.5px`);
        lines.push(`classDef tipo_cierre_frio fill:#334155,stroke:#94a3b8,color:#e2e8f0,stroke-width:2.5px`);
        lines.push(`classDef tipo_escalar fill:#4c1d95,stroke:#a78bfa,color:#ede9fe,stroke-width:2.5px`);
        lines.push(`classDef tipo_alerta fill:#991b1b,stroke:#fca5a5,color:#fee2e2,stroke-width:2.5px`);
        return lines.join('\n');
    }

    // Drag-to-pan (click sostenido + mover)
    function wireDragToPan(wrap) {
        if (!wrap) return;
        let dragging = false;
        let startX = 0, startY = 0, scrollL = 0, scrollT = 0;
        let moved = false;

        wrap.addEventListener('mousedown', (e) => {
            // Permitir drag solo cuando NO se hizo click en un nodo (para no bloquear el click)
            if (e.target.closest('g.node')) return;
            dragging = true;
            moved = false;
            startX = e.pageX;
            startY = e.pageY;
            scrollL = wrap.scrollLeft;
            scrollT = wrap.scrollTop;
            wrap.classList.add('cursor-grabbing');
            wrap.classList.remove('cursor-grab');
        });
        wrap.addEventListener('mouseleave', () => {
            dragging = false;
            wrap.classList.remove('cursor-grabbing');
            wrap.classList.add('cursor-grab');
        });
        wrap.addEventListener('mouseup', () => {
            dragging = false;
            wrap.classList.remove('cursor-grabbing');
            wrap.classList.add('cursor-grab');
        });
        wrap.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dx = e.pageX - startX;
            const dy = e.pageY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
            wrap.scrollLeft = scrollL - dx;
            wrap.scrollTop = scrollT - dy;
            e.preventDefault();
        });
        // Cancelar el click si hubo arrastre (evita que abra modal al hacer pan sobre un nodo)
        wrap.addEventListener('click', (e) => {
            if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
        }, true);
    }

    // Handler expuesto a Mermaid al hacer click en un nodo
    window.__bfNodeClick = function (nodeId) {
        showNodeModal(nodeId);
    };

    function showNodeModal(nodeId) {
        const node = flowData.flujo.nodos.find(n => n.id === nodeId);
        if (!node) return;

        const mensajeKey = STEP_TO_MENSAJE[nodeId];
        const dynamicText = getDynamicStepText(nodeId);
        const fixedText = mensajeKey ? (flowData.catalogo.mensajes[mensajeKey] || '') : null;
        const bodyText = fixedText || dynamicText || node.descripcion || '(sin mensaje)';
        const editable = !!mensajeKey;

        // Overlay
        let overlay = document.getElementById('bf-node-modal');
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = 'bf-node-modal';
        overlay.className = 'fixed inset-0 modal-overlay z-50 flex items-center justify-center p-3';
        overlay.innerHTML = `
            <div class="w-full max-w-2xl p-5 sm:p-6 relative max-h-[90vh] flex flex-col" style="background: linear-gradient(180deg, #0a1230 0%, #080e26 100%); border: 1px solid rgba(78,195,205,0.3); border-radius: 1.25rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(78,195,205,0.1);">
                <div class="flex items-start justify-between pb-4 mb-4 border-b border-[#1e3a5f]">
                    <div class="min-w-0 pr-3">
                        <div class="flex items-center gap-2 mb-1.5">
                            <span class="bf-badge-type" style="background: ${badgeBg(node.tipo)}; color: ${badgeFg(node.tipo)}; border: 1px solid ${badgeBorder(node.tipo)};">${nodeTypeLabel(node.tipo)}</span>
                            <span class="text-[10px] font-mono text-gray-500 bg-[#050820] border border-[#1e3a5f] rounded px-1.5 py-0.5">step ${node.step}</span>
                        </div>
                        <h3 class="text-lg sm:text-xl font-bold text-white">${esc(node.titulo)}</h3>
                    </div>
                    <button id="bf-modal-close" class="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#050820] transition-colors"><i class='bx bx-x text-2xl'></i></button>
                </div>
                <div class="flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-3">
                    <div>
                        <div class="text-[11px] uppercase tracking-wider text-[#4ec3cd] font-bold mb-2 flex items-center gap-1.5">
                            <i class='bx ${fixedText ? 'bx-chat' : dynamicText ? 'bx-code-alt' : 'bx-info-circle'}'></i>
                            ${fixedText ? 'Texto que envía el bot (editable)' : dynamicText ? 'Texto que envía el bot (generado dinámicamente)' : 'Descripción'}
                        </div>
                        <div class="bg-[#050820] border border-[#1e3a5f] rounded-xl p-4 text-sm text-gray-200 whitespace-pre-wrap font-mono leading-relaxed" style="max-height:50vh;overflow:auto;">${esc(bodyText)}</div>
                    </div>
                    ${!editable && dynamicText ? `
                        <div class="rounded-xl p-3 text-xs flex items-start gap-2" style="background: rgba(78,195,205,0.08); border: 1px solid rgba(78,195,205,0.25); color: #a5f3fc;">
                            <i class='bx bx-info-circle text-base shrink-0 mt-0.5 text-[#4ec3cd]'></i>
                            <span>Este texto se construye con los datos del catálogo. Para cambiarlo, edita las especialidades, cirugías, estudios, laboratorio, clínica o promoción desde sus pestañas.</span>
                        </div>
                    ` : ''}
                </div>
                <div class="pt-4 mt-4 border-t border-[#1e3a5f] flex items-center gap-2">
                    ${editable ? `<button id="bf-modal-edit" class="bf-btn-primary flex-1 flex items-center justify-center gap-2"><i class='bx bx-edit'></i> Editar este mensaje</button>` : ''}
                    <button id="bf-modal-dismiss" class="bf-btn-ghost ${editable ? 'px-5' : 'flex-1'}">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('#bf-modal-close').addEventListener('click', close);
        overlay.querySelector('#bf-modal-dismiss').addEventListener('click', close);
        const editBtn = overlay.querySelector('#bf-modal-edit');
        if (editBtn) editBtn.addEventListener('click', () => {
            close();
            activeTab = 'mensajes';
            expandedCardId = `mensaje:${mensajeKey}`;
            renderTabs();
            renderActiveTab();
            // Scroll al card
            setTimeout(() => {
                const target = document.querySelector('.bf-card-head');
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        });
    }

    // Paleta de badges del modal (match con la paleta Mermaid)
    const BADGE = {
        inicio:      { bg: 'rgba(30,58,138,0.25)',  fg: '#93c5fd', bd: 'rgba(78,195,205,0.4)' },
        menu:        { bg: 'rgba(14,74,96,0.35)',   fg: '#67e8f9', bd: 'rgba(78,195,205,0.5)' },
        info:        { bg: 'rgba(6,78,59,0.3)',     fg: '#6ee7b7', bd: 'rgba(52,211,153,0.4)' },
        captura:     { bg: 'rgba(113,63,18,0.3)',   fg: '#fcd34d', bd: 'rgba(251,191,36,0.4)' },
        cierre:      { bg: 'rgba(22,101,52,0.3)',   fg: '#86efac', bd: 'rgba(74,222,128,0.4)' },
        cierre_frio: { bg: 'rgba(51,65,85,0.5)',    fg: '#cbd5e1', bd: 'rgba(148,163,184,0.4)' },
        escalar:     { bg: 'rgba(76,29,149,0.3)',   fg: '#c4b5fd', bd: 'rgba(167,139,250,0.4)' },
        alerta:      { bg: 'rgba(153,27,27,0.3)',   fg: '#fca5a5', bd: 'rgba(252,165,165,0.4)' },
    };
    function badgeBg(t)     { return (BADGE[t] || BADGE.cierre_frio).bg; }
    function badgeFg(t)     { return (BADGE[t] || BADGE.cierre_frio).fg; }
    function badgeBorder(t) { return (BADGE[t] || BADGE.cierre_frio).bd; }
    function nodeTypeLabel(tipo) {
        return {
            inicio: 'Inicio', menu: 'Menú', info: 'Info', captura: 'Captura de datos',
            cierre: 'Cierre con venta', cierre_frio: 'Cierre sin venta', escalar: 'Escalar a asesor', alerta: 'Alerta médica',
        }[tipo] || tipo;
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
            <div class="mb-4">
                <h3 class="text-lg font-bold text-white flex items-center gap-2.5">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(78,195,205,0.15)] border border-[rgba(78,195,205,0.35)] text-[#4ec3cd]">
                        <i class='bx ${t.icon} text-lg'></i>
                    </span>
                    ${t.title}
                </h3>
                <p class="text-xs text-gray-400 mt-1 ml-11">${t.hint} Click en una tarjeta para editarla.</p>
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
            card.className = `bf-card overflow-hidden ${isExpanded ? 'active' : ''}`;

            const headerHtml = `
                <button type="button" class="bf-card-head w-full text-left p-4 flex items-start justify-between gap-2 cursor-pointer transition-colors">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span class="text-xl leading-none">${esc(emoji)}</span>
                            <span class="font-semibold text-white truncate">${esc(nombre)}</span>
                            ${edited ? '<span class="bf-badge-edited">editado</span>' : ''}
                        </div>
                        <div class="text-xs text-gray-300 flex items-center gap-3 flex-wrap">
                            ${priceBadge(item, tipo)}
                            ${item.horario ? `<span class="flex items-center gap-1 text-gray-400"><i class='bx bx-time text-sm'></i> ${esc(item.horario)}</span>` : ''}
                            ${item.area ? `<span class="text-[10px] uppercase tracking-wider bg-[rgba(78,195,205,0.1)] border border-[rgba(78,195,205,0.3)] text-[#4ec3cd] rounded-full px-2 py-0.5">${esc(item.area)}</span>` : ''}
                        </div>
                    </div>
                    <i class='bx ${isExpanded ? 'bx-chevron-up' : 'bx-chevron-down'} text-xl text-[#4ec3cd] shrink-0'></i>
                </button>
            `;

            let editorHtml = '';
            if (isExpanded) {
                editorHtml = `
                    <div class="border-t border-[#1e3a5f] bg-[#050820]/50 p-4 space-y-3">
                        ${fields.map(f => {
                            const val = item[f.k] == null ? '' : item[f.k];
                            const defVal = def[f.k] == null ? '—' : def[f.k];
                            const input = f.type === 'textarea'
                                ? `<textarea data-k="${f.k}" rows="2" class="bf-input">${esc(val)}</textarea>`
                                : `<input data-k="${f.k}" type="${f.type}" value="${esc(val)}" class="bf-input">`;
                            return `
                                <div>
                                    <div class="flex items-baseline justify-between mb-1.5">
                                        <label class="text-[11px] uppercase tracking-wider text-gray-300 font-bold">${esc(f.label)}</label>
                                        <span class="text-[10px] text-gray-500 font-mono" title="Valor de fábrica">fábrica: ${esc(defVal)}</span>
                                    </div>
                                    ${input}
                                    ${f.hint ? `<p class="text-[10px] text-gray-500 mt-1">${esc(f.hint)}</p>` : ''}
                                </div>
                            `;
                        }).join('')}
                        <div class="flex items-center gap-2 pt-2">
                            <button class="bf-save bf-btn-primary flex-1 flex items-center justify-center gap-2">
                                <i class='bx bx-save'></i> Guardar cambios
                            </button>
                            ${edited ? `<button class="bf-reset bf-btn-danger flex items-center gap-1.5" title="Restaurar fábrica"><i class='bx bx-reset'></i> Fábrica</button>` : ''}
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
            <div class="mb-4">
                <h3 class="text-lg font-bold text-white flex items-center gap-2.5">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(78,195,205,0.15)] border border-[rgba(78,195,205,0.35)] text-[#4ec3cd]">
                        <i class='bx bx-message-rounded-dots text-lg'></i>
                    </span>
                    Mensajes del bot
                </h3>
                <p class="text-xs text-gray-400 mt-1 ml-11">Los textos exactos que envía el bot. Formato WhatsApp: *negrita*, _cursiva_. Enter = salto de línea.</p>
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
            card.className = `bf-card overflow-hidden ${isExpanded ? 'active' : ''}`;

            const preview = current.length > 140 ? current.slice(0, 140) + '…' : current;
            card.innerHTML = `
                <button type="button" class="bf-card-head w-full text-left p-4 flex items-start justify-between gap-2 transition-colors">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                            <span class="font-semibold text-white">${esc(m.titulo)}</span>
                            ${edited ? '<span class="bf-badge-edited">editado</span>' : ''}
                            <span class="text-[10px] font-mono text-gray-500 bg-[#050820] border border-[#1e3a5f] rounded px-1.5 py-0.5">${esc(m.k)}</span>
                        </div>
                        <p class="text-xs text-gray-400 mb-2">${esc(m.desc)}</p>
                        <div class="text-sm text-gray-200 bg-[#050820] border border-[#1e3a5f] rounded-lg p-3 whitespace-pre-wrap leading-relaxed">${esc(preview)}</div>
                    </div>
                    <i class='bx ${isExpanded ? 'bx-chevron-up' : 'bx-chevron-down'} text-xl text-[#4ec3cd] shrink-0'></i>
                </button>
                ${isExpanded ? `
                    <div class="border-t border-[#1e3a5f] bg-[#050820]/50 p-4 space-y-3">
                        <div>
                            <label class="text-[11px] uppercase tracking-wider text-gray-300 font-bold">Texto exacto que envía el bot</label>
                            <textarea class="bf-msg-text bf-input mt-1.5 font-mono leading-relaxed" rows="8">${esc(current)}</textarea>
                        </div>
                        ${edited ? `
                        <details class="text-xs">
                            <summary class="text-gray-400 cursor-pointer hover:text-[#4ec3cd]">Ver texto de fábrica</summary>
                            <pre class="mt-2 bg-black/40 border border-[#1e3a5f] rounded-lg p-3 text-gray-400 whitespace-pre-wrap text-xs leading-relaxed">${esc(def)}</pre>
                        </details>
                        ` : ''}
                        <div class="flex items-center gap-2 pt-1">
                            <button class="bf-save bf-btn-primary flex-1 flex items-center justify-center gap-2">
                                <i class='bx bx-save'></i> Guardar mensaje
                            </button>
                            ${edited ? `<button class="bf-reset bf-btn-danger flex items-center gap-1.5"><i class='bx bx-reset'></i> Fábrica</button>` : ''}
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
            <div class="mb-4">
                <h3 class="text-lg font-bold text-white flex items-center gap-2.5">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(78,195,205,0.15)] border border-[rgba(78,195,205,0.35)] text-[#4ec3cd]">
                        <i class='bx bx-map text-lg'></i>
                    </span>
                    Datos de la clínica
                </h3>
                <p class="text-xs text-gray-400 mt-1 ml-11">Información que el bot envía cuando el cliente elige "Ubicación y horarios".</p>
            </div>
            <div class="bf-panel p-5 sm:p-6 space-y-4 max-w-2xl">
                ${edited ? '<div class="bg-amber-950/30 border border-amber-800/60 rounded-lg px-3 py-2 text-xs text-amber-200 flex items-center gap-2"><i class="bx bx-edit"></i> Hay campos editados.</div>' : ''}
                ${fields.map(f => `
                    <div>
                        <label class="text-[11px] uppercase tracking-wider text-gray-300 font-bold">${esc(f.label)}</label>
                        <input data-k="${f.k}" type="text" value="${esc(c[f.k] || '')}" class="bf-input mt-1.5">
                    </div>
                `).join('')}
                <div class="flex items-center gap-2 pt-2 border-t border-[#1e3a5f]">
                    <button id="bf-clinica-save" class="bf-btn-primary flex-1 flex items-center justify-center gap-2">
                        <i class='bx bx-save'></i> Guardar cambios
                    </button>
                    ${edited ? `<button id="bf-clinica-reset" class="bf-btn-danger flex items-center gap-1.5"><i class='bx bx-reset'></i> Fábrica</button>` : ''}
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
            <div class="mb-4">
                <h3 class="text-lg font-bold text-white flex items-center gap-2.5">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[rgba(78,195,205,0.15)] border border-[rgba(78,195,205,0.35)] text-[#4ec3cd]">
                        <i class='bx bx-gift text-lg'></i>
                    </span>
                    Promoción vigente
                </h3>
                <p class="text-xs text-gray-400 mt-1 ml-11">El bot muestra este mensaje adicional cuando el cliente pregunta por el procedimiento al que aplica.</p>
            </div>
            <div class="bf-panel p-5 sm:p-6 space-y-4 max-w-2xl">
                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${activa ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-700' : 'bg-slate-900/80 text-slate-400 border border-slate-700'}">
                    <span class="w-2 h-2 rounded-full ${activa ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}"></span>
                    ${activa ? 'ACTIVA — el bot la está mostrando' : 'EXPIRADA — el bot no la muestra'}
                </div>
                ${edited ? '<div class="bg-amber-950/30 border border-amber-800/60 rounded-lg px-3 py-2 text-xs text-amber-200 flex items-center gap-2"><i class="bx bx-edit"></i> Promoción editada.</div>' : ''}
                <div>
                    <label class="text-[11px] uppercase tracking-wider text-gray-300 font-bold">Vigente hasta</label>
                    <input data-k="activa_hasta" type="text" value="${esc(p.activa_hasta || '')}" class="bf-input mt-1.5" placeholder="2026-11-30T23:59:59">
                    <p class="text-[10px] text-gray-500 mt-1">Formato ISO: YYYY-MM-DDTHH:MM:SS</p>
                </div>
                <div>
                    <label class="text-[11px] uppercase tracking-wider text-gray-300 font-bold">Texto que envía el bot</label>
                    <textarea data-k="texto" rows="4" class="bf-input mt-1.5 font-mono leading-relaxed">${esc(p.texto || '')}</textarea>
                </div>
                <div>
                    <label class="text-[11px] uppercase tracking-wider text-gray-300 font-bold">ID del procedimiento al que aplica</label>
                    <input data-k="aplica_a_procedimiento_id" type="text" value="${esc(p.aplica_a_procedimiento_id || '')}" class="bf-input mt-1.5" placeholder="orquidopexia">
                    <p class="text-[10px] text-gray-500 mt-1">Ej: orquidopexia, rinoplastia, mommy_makeover, etc.</p>
                </div>
                <div class="flex items-center gap-2 pt-2 border-t border-[#1e3a5f]">
                    <button id="bf-promo-save" class="bf-btn-primary flex-1 flex items-center justify-center gap-2">
                        <i class='bx bx-save'></i> Guardar promoción
                    </button>
                    ${edited ? `<button id="bf-promo-reset" class="bf-btn-danger flex items-center gap-1.5"><i class='bx bx-reset'></i> Fábrica</button>` : ''}
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
