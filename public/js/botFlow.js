// ═══════════════════════════════════════════════════════════════
//  Flujo del Bot — diagrama Mermaid + editor de nodos
// ═══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // Estado
    let flowData = null;     // GET /api/bot/flow-mit response
    let currentNode = null;  // { tipo, id }
    let zoom = 1;

    // Mermaid: init con tema dark
    if (window.mermaid) {
        mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            securityLevel: 'loose',
            flowchart: { curve: 'basis', htmlLabels: true, padding: 10 },
            themeVariables: {
                primaryColor: '#0e1555',
                primaryTextColor: '#e5e7eb',
                primaryBorderColor: '#1e3a5f',
                lineColor: '#4ec3cd',
                tertiaryColor: '#070b2e',
                fontSize: '13px',
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            },
        });
    }

    // Utilidades
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmtPrice = (n) => n == null ? '—' : `$${Number(n).toLocaleString('es-MX')}`;

    // Toast reutilizando los estilos existentes del CRM si existen
    function toast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            const label = type === 'error' ? 'Error' : type === 'success' ? 'Listo' : 'Info';
            window.showToast(label, message, type === 'error' ? 'red' : type === 'success' ? 'green' : 'blue');
            return;
        }
        console.log(`[${type}]`, message);
    }

    // ─────────────────────────────────────────
    //  Toggle de vista (patrón idéntico a parrilla)
    // ─────────────────────────────────────────
    function showBotFlowView() {
        const crm = document.getElementById('crm-main-view');
        const parrilla = document.getElementById('parrilla-view');
        const view = document.getElementById('bot-flow-view');
        if (crm) crm.classList.add('hidden');
        if (parrilla) { parrilla.classList.add('hidden'); parrilla.classList.remove('flex'); }
        if (view) {
            view.classList.remove('hidden');
            view.classList.add('flex');
        }
        loadFlow();
    }

    function hideBotFlowView() {
        const view = document.getElementById('bot-flow-view');
        if (view) {
            view.classList.add('hidden');
            view.classList.remove('flex');
        }
    }

    // ─────────────────────────────────────────
    //  Carga del flujo desde el backend
    // ─────────────────────────────────────────
    async function loadFlow() {
        const loader = document.getElementById('bot-flow-diagram-loader');
        const diagram = document.getElementById('bot-flow-diagram');
        if (loader) loader.style.display = 'flex';
        if (diagram) diagram.innerHTML = '';
        try {
            const res = await fetch('/api/bot/flow-mit');
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Error cargando flujo');
            flowData = json.data;
            await renderDiagram();
            // Si había un nodo abierto, refrescar su detalle
            if (currentNode) openNode(currentNode.tipo, currentNode.id);
        } catch (err) {
            console.error(err);
            if (diagram) diagram.innerHTML = `<div class="text-red-400 p-4 text-sm">Error: ${esc(err.message)}</div>`;
            toast('No se pudo cargar el flujo del bot', 'error');
        } finally {
            if (loader) loader.style.display = 'none';
        }
    }

    // ─────────────────────────────────────────
    //  Generación del grafo Mermaid
    // ─────────────────────────────────────────
    function buildMermaidSource() {
        const { flujo, catalogo } = flowData;
        const lines = ['flowchart TD'];

        // Nodos "reales" del flujo
        for (const n of flujo.nodos) {
            const lbl = `${esc(n.titulo)}<br/><span style='font-size:10px;opacity:.7'>step ${n.step}</span>`;
            let shape;
            if (n.tipo === 'inicio') shape = `(["${lbl}"])`;
            else if (n.tipo === 'menu') shape = `[["${lbl}"]]`;
            else if (n.tipo === 'info') shape = `["${lbl}"]`;
            else if (n.tipo === 'captura') shape = `[/"${lbl}"/]`;
            else if (n.tipo === 'cierre') shape = `(("${lbl}"))`;
            else if (n.tipo === 'cierre_frio') shape = `(("${lbl}"))`;
            else if (n.tipo === 'escalar') shape = `{"${lbl}"}`;
            else if (n.tipo === 'alerta') shape = `{{"${lbl}"}}`;
            else shape = `["${lbl}"]`;
            lines.push(`${n.id}${shape}`);
            lines.push(`class ${n.id} tipo_${n.tipo}`);
            lines.push(`click ${n.id} call window.__botFlowClick("step","${n.id}")`);
        }

        // Nodos "hijos" por especialidad (bajo step_11)
        const especFrame = 'step_11_especs';
        lines.push(`subgraph ${especFrame}["Especialidades (click para editar precio/horario)"]`);
        for (const e of catalogo.especialidades) {
            const precio = e.costo == null ? 'sin precio fijo' : fmtPrice(e.costo);
            const lbl = `${esc(e.emoji + ' ' + e.nombre)}<br/><span style='font-size:10px;opacity:.75'>${precio}</span>`;
            const nid = `esp_${e.id}`;
            lines.push(`${nid}["${lbl}"]`);
            lines.push(`class ${nid} tipo_item`);
            lines.push(`click ${nid} call window.__botFlowClick("especialidad","${e.id}")`);
        }
        lines.push('end');
        lines.push(`step_11 -.-> ${especFrame}`);

        // Procedimientos bajo step_21
        const procFrame = 'step_21_procs';
        lines.push(`subgraph ${procFrame}["Procedimientos (click para editar precio)"]`);
        for (const p of catalogo.procedimientos) {
            const lbl = `${esc(p.nombre)}<br/><span style='font-size:10px;opacity:.75'>desde ${esc(p.desde)}</span>`;
            const nid = `proc_${p.id}`;
            lines.push(`${nid}["${lbl}"]`);
            lines.push(`class ${nid} tipo_item`);
            lines.push(`click ${nid} call window.__botFlowClick("procedimiento","${p.id}")`);
        }
        lines.push('end');
        lines.push(`step_21 -.-> ${procFrame}`);

        // Estudios y laboratorio bajo step_32 y step_30
        const estFrame = 'step_32_ests';
        lines.push(`subgraph ${estFrame}["Estudios con cita"]`);
        for (const e of catalogo.estudios) {
            const precio = e.costo == null ? 'con asesor' : fmtPrice(e.costo);
            const lbl = `${esc(e.nombre)}<br/><span style='font-size:10px;opacity:.75'>${precio}</span>`;
            const nid = `est_${e.id}`;
            lines.push(`${nid}["${lbl}"]`);
            lines.push(`class ${nid} tipo_item`);
            lines.push(`click ${nid} call window.__botFlowClick("estudio","${e.id}")`);
        }
        lines.push('end');
        lines.push(`step_32 -.-> ${estFrame}`);

        const labFrame = 'step_30_labs';
        lines.push(`subgraph ${labFrame}["Laboratorio clínico (sin cita)"]`);
        for (const l of catalogo.laboratorio) {
            const lbl = `${esc(l.nombre)}<br/><span style='font-size:10px;opacity:.75'>${fmtPrice(l.precio)}</span>`;
            const nid = `lab_${l.id}`;
            lines.push(`${nid}["${lbl}"]`);
            lines.push(`class ${nid} tipo_item`);
            lines.push(`click ${nid} call window.__botFlowClick("laboratorio","${l.id}")`);
        }
        lines.push('end');
        lines.push(`step_30 -.-> ${labFrame}`);

        // Nodos "globales" (clínica, promoción)
        lines.push(`clinica_node["📍 Datos de la clínica<br/><span style='font-size:10px;opacity:.75'>dirección, horario, WhatsApp</span>"]`);
        lines.push(`class clinica_node tipo_global`);
        lines.push(`click clinica_node call window.__botFlowClick("clinica","")`);
        lines.push(`step_40 --> clinica_node`);

        lines.push(`promo_node["🎉 Promoción vigente<br/><span style='font-size:10px;opacity:.75'>${esc((flowData.promocion_activa && flowData.promocion_activa.activa) ? 'Activa' : 'Sin promo')}</span>"]`);
        lines.push(`class promo_node tipo_global`);
        lines.push(`click promo_node call window.__botFlowClick("promocion","")`);

        // Aristas del flujo principal — envolvemos el label en comillas dobles
        // para que Mermaid acepte caracteres como ( ) / y comillas tipográficas.
        const edgeLabel = (s) => `"${String(s || '').replace(/["«»]/g, '').replace(/</g, '').replace(/>/g, '')}"`;
        for (const a of flujo.aristas) {
            lines.push(`${a.from} -->|${edgeLabel(a.label)}| ${a.to}`);
        }

        // Clases con color (coinciden con la leyenda del HTML)
        lines.push(`classDef tipo_inicio fill:#1e40af,stroke:#60a5fa,color:#fff`);
        lines.push(`classDef tipo_menu fill:#0ea5e9,stroke:#38bdf8,color:#fff`);
        lines.push(`classDef tipo_info fill:#10b981,stroke:#34d399,color:#042f2e`);
        lines.push(`classDef tipo_captura fill:#eab308,stroke:#fde047,color:#422006`);
        lines.push(`classDef tipo_cierre fill:#22c55e,stroke:#4ade80,color:#052e16`);
        lines.push(`classDef tipo_cierre_frio fill:#64748b,stroke:#94a3b8,color:#fff`);
        lines.push(`classDef tipo_escalar fill:#a855f7,stroke:#c084fc,color:#fff`);
        lines.push(`classDef tipo_alerta fill:#ef4444,stroke:#fca5a5,color:#fff`);
        lines.push(`classDef tipo_item fill:#0e1555,stroke:#4ec3cd,color:#e5e7eb`);
        lines.push(`classDef tipo_global fill:#312e81,stroke:#818cf8,color:#e0e7ff`);

        return lines.join('\n');
    }

    async function renderDiagram() {
        const container = document.getElementById('bot-flow-diagram');
        if (!container || !window.mermaid) return;
        const source = buildMermaidSource();
        try {
            const { svg, bindFunctions } = await mermaid.render('bot-flow-svg-' + Date.now(), source);
            container.innerHTML = svg;
            if (bindFunctions) bindFunctions(container);
            applyZoom();
        } catch (err) {
            console.error('Mermaid error:', err);
            container.innerHTML = `<pre class="text-red-400 text-xs p-2 whitespace-pre-wrap">Error al renderizar diagrama:\n${esc(err.message)}</pre>`;
        }
    }

    // ─────────────────────────────────────────
    //  Click handler expuesto a Mermaid
    // ─────────────────────────────────────────
    window.__botFlowClick = function (tipo, id) {
        openNode(tipo, id);
    };

    // ─────────────────────────────────────────
    //  Panel lateral: ver / editar nodo
    // ─────────────────────────────────────────
    function openNode(tipo, id) {
        currentNode = { tipo, id };
        const emptyEl = document.getElementById('bot-flow-detail-empty');
        const detailEl = document.getElementById('bot-flow-detail');
        if (!detailEl) return;
        emptyEl.classList.add('hidden');
        detailEl.classList.remove('hidden');
        detailEl.classList.add('flex');

        if (tipo === 'step') return renderStepDetail(id);
        if (tipo === 'especialidad') return renderItemEditor('especialidad', id, flowData.catalogo.especialidades, flowData.defaults.especialidades);
        if (tipo === 'procedimiento') return renderItemEditor('procedimiento', id, flowData.catalogo.procedimientos, flowData.defaults.procedimientos);
        if (tipo === 'laboratorio') return renderItemEditor('laboratorio', id, flowData.catalogo.laboratorio, flowData.defaults.laboratorio);
        if (tipo === 'estudio') return renderItemEditor('estudio', id, flowData.catalogo.estudios, flowData.defaults.estudios);
        if (tipo === 'clinica') return renderClinicaEditor();
        if (tipo === 'promocion') return renderPromoEditor();
    }

    function headerHtml(title, subtitle) {
        return `
            <div class="flex items-start justify-between mb-3 pb-3 border-b border-[#1e3a5f]">
                <div class="min-w-0">
                    <h3 class="text-base sm:text-lg font-bold text-white break-words">${esc(title)}</h3>
                    <p class="text-xs text-gray-400 mt-0.5">${esc(subtitle)}</p>
                </div>
                <button id="bot-flow-detail-close" class="text-gray-500 hover:text-white p-1" title="Cerrar"><i class='bx bx-x text-xl'></i></button>
            </div>
        `;
    }

    function wireCloseButton() {
        const btn = document.getElementById('bot-flow-detail-close');
        if (btn) btn.addEventListener('click', () => {
            document.getElementById('bot-flow-detail').classList.add('hidden');
            document.getElementById('bot-flow-detail-empty').classList.remove('hidden');
            currentNode = null;
        });
    }

    // Detalle solo lectura de un step del flujo
    function renderStepDetail(stepId) {
        const node = flowData.flujo.nodos.find(n => n.id === stepId);
        if (!node) return;
        // Para los steps que corresponden a mensajes editables, cargar el mensaje directamente
        const mensajeKey = {
            step_1: 'SALUDO_MENU',
            cierre_venta: 'CIERRE_VENTA',
            cierre_sin_venta: 'CIERRE_SIN_VENTA',
            cierre_distancia: 'CIERRE_SIN_VENTA_DISTANCIA',
            escalar_asesor: 'ESCALAR_ASESOR',
            emergencia: 'EMERGENCIA',
            crisis: 'CRISIS',
            step_70: 'PEDIR_NOMBRE',
            // step_71 no tiene mensaje fijo, se genera dinámicamente
        }[stepId];

        if (mensajeKey) {
            return renderMensajeEditor(mensajeKey, node.titulo);
        }

        // Nodos estructurales: solo lectura
        const detailEl = document.getElementById('bot-flow-detail');
        detailEl.innerHTML = `
            ${headerHtml(node.titulo, `Paso estructural — step ${node.step}`)}
            <div class="flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-3">
                <div>
                    <label class="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Descripción</label>
                    <div class="mt-1 bg-[#070b2e] border border-[#1e3a5f] rounded-md p-3 text-sm text-gray-200 whitespace-pre-wrap">${esc(node.descripcion)}</div>
                </div>
                <div class="bg-cyan-950/30 border border-cyan-800/50 rounded-md p-3 text-xs text-cyan-200">
                    <i class='bx bx-info-circle mr-1'></i>
                    Este paso representa lógica del bot (no un mensaje editable). Para ajustar textos, abre los nodos verdes "Info" o los nodos finales de cierre.
                </div>
            </div>
        `;
        wireCloseButton();
    }

    function renderMensajeEditor(key, label) {
        const current = flowData.catalogo.mensajes[key] || '';
        const def = flowData.defaults.mensajes[key] || '';
        const isOverridden = current !== def;
        const detailEl = document.getElementById('bot-flow-detail');
        detailEl.innerHTML = `
            ${headerHtml(label, `Mensaje del bot — clave: ${key}`)}
            <div class="flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-3">
                ${isOverridden ? '<div class="bg-yellow-950/30 border border-yellow-800/50 rounded-md p-2 text-xs text-yellow-200"><i class="bx bx-edit mr-1"></i>Este mensaje fue editado (diferente al de fábrica).</div>' : ''}
                <div>
                    <label class="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Texto que envía el bot</label>
                    <textarea id="bf-msg-text" rows="10" class="mt-1 w-full bg-[#070b2e] border border-[#1e3a5f] rounded-md p-3 text-sm text-gray-200 focus:outline-none focus:border-cyan-400 resize-y font-mono">${esc(current)}</textarea>
                    <p class="text-[10px] text-gray-500 mt-1">Formato WhatsApp: *negrita* _cursiva_. Usa \\n para salto de línea literal, o solo Enter en el textarea.</p>
                </div>
                ${isOverridden ? `
                <details class="text-xs">
                    <summary class="text-gray-500 cursor-pointer hover:text-gray-300">Ver texto de fábrica</summary>
                    <pre class="mt-2 bg-black/40 border border-[#1e3a5f] rounded-md p-2 text-gray-400 whitespace-pre-wrap text-xs">${esc(def)}</pre>
                </details>
                ` : ''}
            </div>
            <div class="flex items-center gap-2 pt-3 mt-3 border-t border-[#1e3a5f]">
                <button id="bf-msg-save" class="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2">
                    <i class='bx bx-save'></i> Guardar
                </button>
                ${isOverridden ? `<button id="bf-msg-reset" class="px-3 py-2 border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/50 rounded-md text-xs font-semibold transition-colors" title="Volver al mensaje de fábrica"><i class='bx bx-reset'></i></button>` : ''}
            </div>
        `;
        wireCloseButton();
        document.getElementById('bf-msg-save').addEventListener('click', async () => {
            const txt = document.getElementById('bf-msg-text').value;
            await saveNode('mensaje', null, { [key]: txt });
        });
        const resetBtn = document.getElementById('bf-msg-reset');
        if (resetBtn) resetBtn.addEventListener('click', () => resetNode('mensaje', null, [key]));
    }

    // Editor de item (especialidad / procedimiento / lab / estudio)
    function renderItemEditor(tipo, id, liveArr, defaultArr) {
        const item = liveArr.find(x => x.id === id);
        const def = defaultArr.find(x => x.id === id);
        if (!item || !def) return;
        const detailEl = document.getElementById('bot-flow-detail');

        // Campos por tipo
        const fields = {
            especialidad: [
                { k: 'costo', label: 'Costo total (MXN)', type: 'number', help: 'Déjalo vacío si lo confirma un asesor.' },
                { k: 'anticipo', label: 'Anticipo (MXN)', type: 'number' },
                { k: 'resto', label: 'Resto en la cita (MXN)', type: 'number' },
                { k: 'horario', label: 'Horario', type: 'text' },
                { k: 'nota', label: 'Nota adicional', type: 'textarea', help: 'Opcional. Se muestra abajo del horario.' },
                { k: 'asesorConfirma', label: 'Texto "asesor confirma..."', type: 'text', help: 'Solo si el precio NO es fijo. Ej: "anticipo y horario".' },
            ],
            procedimiento: [
                { k: 'desde', label: 'Precio "desde"', type: 'text', help: 'Ej: $47,999 — se muestra tal cual.' },
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
        }[tipo];

        const changed = fields.some(f => item[f.k] !== def[f.k] && !(item[f.k] == null && def[f.k] == null));

        detailEl.innerHTML = `
            ${headerHtml(item.nombre || item.id, `${tipo} — id: ${id}`)}
            <div class="flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-3">
                ${changed ? '<div class="bg-yellow-950/30 border border-yellow-800/50 rounded-md p-2 text-xs text-yellow-200"><i class="bx bx-edit mr-1"></i>Este nodo fue editado.</div>' : ''}
                ${fields.map(f => {
                    const val = item[f.k] == null ? '' : item[f.k];
                    const defVal = def[f.k] == null ? '—' : def[f.k];
                    const input = f.type === 'textarea'
                        ? `<textarea data-k="${f.k}" rows="2" class="w-full bg-[#070b2e] border border-[#1e3a5f] rounded-md px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-400">${esc(val)}</textarea>`
                        : `<input data-k="${f.k}" type="${f.type}" value="${esc(val)}" class="w-full bg-[#070b2e] border border-[#1e3a5f] rounded-md px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-400">`;
                    return `
                        <div>
                            <label class="text-[11px] uppercase tracking-wider text-gray-500 font-bold flex items-center justify-between">
                                <span>${esc(f.label)}</span>
                                <span class="text-gray-600 normal-case text-[10px]" title="Fábrica">fábrica: ${esc(defVal)}</span>
                            </label>
                            <div class="mt-1">${input}</div>
                            ${f.help ? `<p class="text-[10px] text-gray-500 mt-0.5">${esc(f.help)}</p>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="flex items-center gap-2 pt-3 mt-3 border-t border-[#1e3a5f]">
                <button id="bf-item-save" class="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2">
                    <i class='bx bx-save'></i> Guardar
                </button>
                ${changed ? `<button id="bf-item-reset" class="px-3 py-2 border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/50 rounded-md text-xs font-semibold transition-colors" title="Volver a fábrica"><i class='bx bx-reset'></i></button>` : ''}
            </div>
        `;
        wireCloseButton();
        document.getElementById('bf-item-save').addEventListener('click', async () => {
            const patch = {};
            detailEl.querySelectorAll('[data-k]').forEach(el => {
                const k = el.dataset.k;
                let v = el.value;
                if (el.type === 'number') {
                    if (v === '') v = null;
                    else v = Number(v);
                } else if (v === '') {
                    v = null;
                }
                patch[k] = v;
            });
            await saveNode(tipo, id, patch);
        });
        const resetBtn = document.getElementById('bf-item-reset');
        if (resetBtn) resetBtn.addEventListener('click', () => resetNode(tipo, id));
    }

    function renderClinicaEditor() {
        const c = flowData.catalogo.clinica;
        const def = flowData.defaults.clinica;
        const detailEl = document.getElementById('bot-flow-detail');
        const fields = [
            { k: 'direccion', label: 'Dirección' },
            { k: 'whatsapp', label: 'WhatsApp' },
            { k: 'email', label: 'Email' },
            { k: 'web', label: 'Web' },
            { k: 'horario', label: 'Horario' },
            { k: 'maps', label: 'URL Google Maps' },
        ];
        const changed = fields.some(f => c[f.k] !== def[f.k]);
        detailEl.innerHTML = `
            ${headerHtml('Datos de la clínica', 'Información que el bot envía en la opción "Ubicación"')}
            <div class="flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-3">
                ${changed ? '<div class="bg-yellow-950/30 border border-yellow-800/50 rounded-md p-2 text-xs text-yellow-200"><i class="bx bx-edit mr-1"></i>Hay campos editados.</div>' : ''}
                ${fields.map(f => `
                    <div>
                        <label class="text-[11px] uppercase tracking-wider text-gray-500 font-bold">${esc(f.label)}</label>
                        <input data-k="${f.k}" type="text" value="${esc(c[f.k] || '')}" class="mt-1 w-full bg-[#070b2e] border border-[#1e3a5f] rounded-md px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-400">
                    </div>
                `).join('')}
            </div>
            <div class="flex items-center gap-2 pt-3 mt-3 border-t border-[#1e3a5f]">
                <button id="bf-clinica-save" class="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2">
                    <i class='bx bx-save'></i> Guardar
                </button>
                ${changed ? `<button id="bf-clinica-reset" class="px-3 py-2 border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/50 rounded-md text-xs font-semibold transition-colors"><i class='bx bx-reset'></i></button>` : ''}
            </div>
        `;
        wireCloseButton();
        document.getElementById('bf-clinica-save').addEventListener('click', async () => {
            const patch = {};
            detailEl.querySelectorAll('[data-k]').forEach(el => { patch[el.dataset.k] = el.value; });
            await saveNode('clinica', null, patch);
        });
        const resetBtn = document.getElementById('bf-clinica-reset');
        if (resetBtn) resetBtn.addEventListener('click', () => resetNode('clinica', null));
    }

    function renderPromoEditor() {
        const p = flowData.catalogo.promocion;
        const def = flowData.defaults.promocion;
        const detailEl = document.getElementById('bot-flow-detail');
        const changed = JSON.stringify(p) !== JSON.stringify(def);
        const activa = flowData.promocion_activa && flowData.promocion_activa.activa;
        detailEl.innerHTML = `
            ${headerHtml('Promoción vigente', activa ? 'Status: ACTIVA — el bot la muestra en los procedimientos' : 'Status: EXPIRADA — el bot no la muestra')}
            <div class="flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-3">
                ${changed ? '<div class="bg-yellow-950/30 border border-yellow-800/50 rounded-md p-2 text-xs text-yellow-200"><i class="bx bx-edit mr-1"></i>Promoción editada.</div>' : ''}
                <div>
                    <label class="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Vigente hasta (ISO)</label>
                    <input data-k="activa_hasta" type="text" value="${esc(p.activa_hasta || '')}" class="mt-1 w-full bg-[#070b2e] border border-[#1e3a5f] rounded-md px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-400" placeholder="2026-11-30T23:59:59">
                </div>
                <div>
                    <label class="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Texto del mensaje</label>
                    <textarea data-k="texto" rows="4" class="mt-1 w-full bg-[#070b2e] border border-[#1e3a5f] rounded-md px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-400 resize-y">${esc(p.texto || '')}</textarea>
                </div>
                <div>
                    <label class="text-[11px] uppercase tracking-wider text-gray-500 font-bold">ID del procedimiento al que aplica</label>
                    <input data-k="aplica_a_procedimiento_id" type="text" value="${esc(p.aplica_a_procedimiento_id || '')}" class="mt-1 w-full bg-[#070b2e] border border-[#1e3a5f] rounded-md px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-cyan-400">
                    <p class="text-[10px] text-gray-500 mt-0.5">Debe coincidir con un id de procedimiento (ej: orquidopexia).</p>
                </div>
            </div>
            <div class="flex items-center gap-2 pt-3 mt-3 border-t border-[#1e3a5f]">
                <button id="bf-promo-save" class="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2">
                    <i class='bx bx-save'></i> Guardar
                </button>
                ${changed ? `<button id="bf-promo-reset" class="px-3 py-2 border border-red-800/60 bg-red-950/30 text-red-300 hover:bg-red-900/50 rounded-md text-xs font-semibold transition-colors"><i class='bx bx-reset'></i></button>` : ''}
            </div>
        `;
        wireCloseButton();
        document.getElementById('bf-promo-save').addEventListener('click', async () => {
            const patch = {};
            detailEl.querySelectorAll('[data-k]').forEach(el => { patch[el.dataset.k] = el.value; });
            await saveNode('promocion', null, patch);
        });
        const resetBtn = document.getElementById('bf-promo-reset');
        if (resetBtn) resetBtn.addEventListener('click', () => resetNode('promocion', null));
    }

    // ─────────────────────────────────────────
    //  Guardar / resetear nodo en el backend
    // ─────────────────────────────────────────
    async function saveNode(tipo, id, patch) {
        try {
            const res = await fetch('/api/bot/flow-mit/node', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo, id, patch }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Error guardando');
            toast('Guardado. El bot usa los nuevos valores al instante.', 'success');
            await loadFlow();
        } catch (err) {
            console.error(err);
            toast('No se pudo guardar: ' + err.message, 'error');
        }
    }

    async function resetNode(tipo, id) {
        if (!confirm('¿Restaurar este nodo a sus valores de fábrica?')) return;
        try {
            const res = await fetch('/api/bot/flow-mit/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipo, id }),
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Error restaurando');
            toast('Restaurado a fábrica.', 'success');
            await loadFlow();
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
            toast('Flujo restaurado a fábrica completo.', 'success');
            await loadFlow();
        } catch (err) {
            toast('No se pudo restaurar: ' + err.message, 'error');
        }
    }

    // ─────────────────────────────────────────
    //  Zoom del diagrama
    // ─────────────────────────────────────────
    function applyZoom() {
        const el = document.getElementById('bot-flow-diagram');
        if (el) el.style.transform = `scale(${zoom})`;
    }

    // ─────────────────────────────────────────
    //  Bootstrap (al cargar la página)
    // ─────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('bot-flow-btn');
        if (!btn) return;

        btn.addEventListener('click', showBotFlowView);

        // Al clickear cualquier otra tab, ocultamos esta vista
        document.querySelectorAll('.brand-btn').forEach(b => b.addEventListener('click', hideBotFlowView));
        const myClients = document.getElementById('my-clients-btn');
        if (myClients) myClients.addEventListener('click', hideBotFlowView);
        const parrillaBtn = document.getElementById('parrilla-btn');
        if (parrillaBtn) parrillaBtn.addEventListener('click', hideBotFlowView);

        // Controles de la vista
        const reload = document.getElementById('bot-flow-reload');
        if (reload) reload.addEventListener('click', loadFlow);
        const resetAllBtn = document.getElementById('bot-flow-reset-all');
        if (resetAllBtn) resetAllBtn.addEventListener('click', resetAll);

        const zi = document.getElementById('bot-flow-zoom-in');
        const zo = document.getElementById('bot-flow-zoom-out');
        const zr = document.getElementById('bot-flow-zoom-reset');
        if (zi) zi.addEventListener('click', () => { zoom = Math.min(zoom + 0.15, 2.5); applyZoom(); });
        if (zo) zo.addEventListener('click', () => { zoom = Math.max(zoom - 0.15, 0.4); applyZoom(); });
        if (zr) zr.addEventListener('click', () => { zoom = 1; applyZoom(); });
    });
})();
