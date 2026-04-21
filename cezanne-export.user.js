// ==UserScript==
// @name         Cezanne - Exportar Maestro de empleados
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Exportador con autorización por código
// @match        *://*/CezanneHR/*
// @match        https://w3.cezanneondemand.com/*
// @grant        GM_addStyle
// @connect      crimson-breeze-86fb.jy734933371.workers.dev
// @updateURL    https://raw.githubusercontent.com/Junmx01/Cezanne-Tampermonky/main/cezanne-export.user.js
// @downloadURL  https://raw.githubusercontent.com/Junmx01/Cezanne-Tampermonky/main/cezanne-export.user.js
// ==/UserScript==

(function () {
    'use strict';

    const AUTH_URL          = 'https://crimson-breeze-86fb.jy734933371.workers.dev';
    const PANEL_ID          = 'jj-export-panel';
    const MINI_ID           = 'jj-export-mini';
    const STORAGE_POS       = 'jj_export_panel_pos';
    const STORAGE_COLLAPSED = 'jj_export_panel_collapsed';
    const STORAGE_TOKEN     = 'jj_auth_token';
    const INFORME_HREF      = '/CezanneHR/-/IQS/node/cf2ce6e3-6382-444c-800d-ea1502e71db5';
    const TARGET_TEMPLATE   = 'Maestro de empleados (People & Organization)';

    // ── Auth ──
    function getStoredToken() { return localStorage.getItem(STORAGE_TOKEN) || ''; }
    function saveToken(t)     { localStorage.setItem(STORAGE_TOKEN, t); }
    function clearToken()     { localStorage.removeItem(STORAGE_TOKEN); }

    async function verifyToken(token) {
        try {
            const res = await fetch(`${AUTH_URL}?token=${encodeURIComponent(token)}`);
            const data = await res.json();
            return data.ok === true;
        } catch { return false; }
    }

    function showAuthDialog(onSuccess) {
        if (document.getElementById('jj-auth-overlay')) return;
        const style = document.createElement('style');
        style.textContent = `
            #jj-auth-overlay {
                position: fixed; inset: 0; z-index: 2147483646;
                background: rgba(15,23,42,0.45); backdrop-filter: blur(6px);
                display: flex; align-items: center; justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            #jj-auth-box {
                background: #fff; border-radius: 20px;
                padding: 32px 28px 24px; width: 320px;
                box-shadow: 0 24px 60px rgba(15,23,42,0.22);
                display: flex; flex-direction: column; gap: 16px;
            }
            #jj-auth-box h2 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
            #jj-auth-box p  { margin: 0; font-size: 13px; color: #64748b; line-height: 1.5; }
            #jj-auth-input {
                width: 100%; padding: 10px 12px;
                border: 1.5px solid #cbd5e1; border-radius: 10px;
                font-size: 14px; color: #0f172a; outline: none;
                transition: border-color 0.15s; box-sizing: border-box;
            }
            #jj-auth-input:focus { border-color: #94a3b8; }
            #jj-auth-input.error { border-color: #ef4444; }
            #jj-auth-err { font-size: 12px; color: #ef4444; margin: -8px 0 0; display: none; }
            #jj-auth-cancel {
                width: 100%; padding: 9px; background: transparent; color: #94a3b8;
                border: 1px solid rgba(203,213,225,0.6); border-radius: 10px;
                font-size: 13px; cursor: pointer;
            }
            #jj-auth-submit {
                width: 100%; padding: 11px; background: #0f172a; color: #fff;
                border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;
            }
            #jj-auth-submit:disabled { background: #94a3b8; cursor: not-allowed; }
        `;
        document.head.appendChild(style);
        const overlay = document.createElement('div');
        overlay.id = 'jj-auth-overlay';
        overlay.innerHTML = `
            <div id="jj-auth-box">
                <h2>🔐 Cezanne Exporter</h2>
                <p>Introduce el código de autorización proporcionado por el administrador.</p>
                <input id="jj-auth-input" type="text" placeholder="Código de autorización" autocomplete="off" spellcheck="false" />
                <div id="jj-auth-err">Código no válido. Contacta con el administrador.</div>
                <button id="jj-auth-submit">Verificar</button>
                <button id="jj-auth-cancel">Cancelar</button>
            </div>`;
        document.body.appendChild(overlay);
        const input  = overlay.querySelector('#jj-auth-input');
        const btn    = overlay.querySelector('#jj-auth-submit');
        const cancel = overlay.querySelector('#jj-auth-cancel');
        const errMsg = overlay.querySelector('#jj-auth-err');
        async function attempt() {
            const token = input.value.trim();
            if (!token) return;
            btn.disabled = true; btn.textContent = 'Verificando…';
            errMsg.style.display = 'none'; input.classList.remove('error');
            const ok = await verifyToken(token);
            if (ok) { saveToken(token); overlay.remove(); onSuccess(); }
            else {
                btn.disabled = false; btn.textContent = 'Verificar';
                input.classList.add('error'); errMsg.style.display = 'block'; input.focus();
            }
        }
        btn.addEventListener('click', attempt);
        cancel.addEventListener('click', () => overlay.remove());
        input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        input.focus();
    }

    // ── Utilidades ──
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function norm(el) {
        return (el?.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function isVisible(el) {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' &&
               (el.offsetParent !== null || s.position === 'fixed');
    }

    async function waitFor(fn, timeout = 25000, interval = 400, msg = 'Tiempo de espera agotado') {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const r = fn();
            if (r) return r;
            await sleep(interval);
        }
        throw new Error(msg);
    }

    function findButton(text) {
        return Array.from(document.querySelectorAll('button'))
            .find(b => norm(b) === text && isVisible(b) && !b.disabled);
    }

    async function clickButton(text, timeout = 25000) {
        const btn = await waitFor(() => findButton(text), timeout, 400, `No se encontró el botón: "${text}"`);
        btn.click();
    }

    // ── Pasos del flujo ──

    // Paso 1: navegar a Informe Resumen de Personas
    async function paso1_navegar() {
        setStatus('running', 'Paso 1/6: Navegando al informe…');

        // ¿Ya estamos en la página correcta? (botón Utilizar Plantilla Existente visible)
        if (findButton('Utilizar Plantilla Existente')) return;

        // Buscar enlace directo al informe
        let link = document.querySelector(
            `a[href="${INFORME_HREF}"], a[id="navLink-cf2ce6e3-6382-444c-800d-ea1502e71db5"]`
        );

        // Si no aparece, expandir el menú lateral primero
        if (!link) {
            const menuIcon = document.querySelector(
                'a[title="Informes y Analíticas"], a[id="navLink-9be6b119-d395-4322-8a0b-9dc8ba2f84f4"], #ea96f17f-06cc-4493-a0d8-f527aaf01d9c'
            );
            if (!menuIcon) throw new Error('No se encontró el menú lateral "Informes y Analíticas"');
            menuIcon.click();
            await sleep(1500);
            link = await waitFor(
                () => document.querySelector(`a[href="${INFORME_HREF}"], a[id="navLink-cf2ce6e3-6382-444c-800d-ea1502e71db5"]`),
                10000, 300, 'No se encontró "Informe Resumen de Personas" en el menú'
            );
        }

        link.click();

        // Esperar a que cargue la página (aparece el botón Utilizar Plantilla Existente)
        await waitFor(() => findButton('Utilizar Plantilla Existente'), 25000, 400, 'La página del informe tardó demasiado en cargar');
        await sleep(400);
    }

    // Paso 2: clic en "Utilizar Plantilla Existente"
    async function paso2_usarPlantilla() {
        setStatus('running', 'Paso 2/6: Abriendo plantillas…');
        await clickButton('Utilizar Plantilla Existente');
        // Esperar a que aparezca el desplegable de plantillas
        await waitFor(
            () => document.querySelector('mat-select, [role="combobox"]') && isVisible(document.querySelector('mat-select, [role="combobox"]')),
            15000, 300, 'No apareció el desplegable de plantillas'
        );
        await sleep(600);
    }

    // Paso 3: abrir el dropdown y seleccionar la plantilla
    async function paso3_seleccionarPlantilla() {
        setStatus('running', 'Paso 3/6: Seleccionando plantilla…');

        const matSelect = await waitFor(() => {
            return Array.from(document.querySelectorAll('mat-select')).find(el => isVisible(el));
        }, 15000, 300, 'No se encontró el desplegable mat-select');

        // Intentar abrir el dropdown
        const trigger = matSelect.querySelector('.mat-mdc-select-trigger') || matSelect;
        matSelect.focus();
        await sleep(200);
        trigger.click();
        await sleep(800);

        // Si no se abrió, intentar con eventos de teclado
        const panelOpen = () => !!document.querySelector('.cdk-overlay-pane mat-option, .cdk-overlay-pane .mat-mdc-option');
        if (!panelOpen()) {
            ['keydown', 'keyup'].forEach(type =>
                matSelect.dispatchEvent(new KeyboardEvent(type, { key: ' ', code: 'Space', keyCode: 32, bubbles: true, cancelable: true }))
            );
            await sleep(600);
        }
        if (!panelOpen()) {
            for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
                trigger.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, view: window }));
            await waitFor(panelOpen, 8000, 300, 'No se pudo abrir el desplegable de plantillas');
        }

        // Buscar y clicar la opción correcta
        const option = await waitFor(
            () => Array.from(document.querySelectorAll('.cdk-overlay-pane mat-option, .cdk-overlay-pane .mat-mdc-option'))
                       .find(el => norm(el) === TARGET_TEMPLATE && isVisible(el)),
            10000, 300, `No se encontró la opción "${TARGET_TEMPLATE}"`
        );
        option.click();
        await sleep(800);
    }

    // Paso 4: primer "Próximo"
    async function paso4_proximoUno() {
        setStatus('running', 'Paso 4/6: Avanzando (1/2)…');
        await clickButton('Próximo');
        await sleep(1500);
    }

    // Paso 5: verificar/marcar checkbox y segundo "Próximo"
    async function paso5_checkboxYproximo() {
        setStatus('running', 'Paso 5/6: Verificando opciones…');

        // Esperar a que aparezca el checkbox
        const checkbox = await waitFor(
            () => {
                // Buscar por aria-label específico
                const byLabel = document.querySelector('input[type="checkbox"][aria-label="Automatización para datos de entrada y salida"]');
                if (byLabel && isVisible(byLabel)) return byLabel;
                // Fallback: cualquier checkbox kendocheckbox visible
                return Array.from(document.querySelectorAll('input[type="checkbox"][kendocheckbox], input.k-checkbox'))
                    .find(el => isVisible(el));
            },
            20000, 400, 'No apareció el checkbox de opciones'
        );

        // Marcar si no está marcado
        if (!checkbox.checked) {
            checkbox.click();
            await sleep(400);
        }

        // Segundo Próximo
        await clickButton('Próximo');

        // Esperar a que cargue la siguiente página (criteria-builder o Guardar y Exportar)
        await waitFor(
            () => document.querySelector('#criteria-builder-operator-all') || findButton('Guardar y Exportar'),
            30000, 500, 'La página de criterios tardó demasiado en cargar'
        );
        await sleep(600);
    }

    // Paso 6: guardar y exportar
    async function paso6_guardar() {
        setStatus('running', 'Paso 6/6: Exportando…');
        await clickButton('Guardar y Exportar');
        await sleep(1000);
        setStatus('done', '✅ Exportación completada');
    }

    // ── Flujo principal ──
    async function runExportFlow() {
        try {
            window.__jj_export_running = true;
            await paso1_navegar();
            await paso2_usarPlantilla();
            await paso3_seleccionarPlantilla();
            await paso4_proximoUno();
            await paso5_checkboxYproximo();
            await paso6_guardar();
        } catch (err) {
            console.error('[Cezanne Exporter]', err);
            setStatus('error', `❌ ${err.message}`);
        } finally {
            window.__jj_export_running = false;
        }
    }

    // ── Auth flow ──
    let authVerified = false;

    async function ensureAuth(onSuccess) {
    if (authVerified) { onSuccess(); return; }
    const token = getStoredToken();
    if (token) { authVerified = true; onSuccess(); return; } // ← 有token直接放行
    showAuthDialog(() => { authVerified = true; onSuccess(); });
}

    // ── Status ──
    function setStatus(type, msg) {
        const toast = document.querySelector('#jj-toast');
        const text  = document.querySelector('#jj-status-text');
        if (toast) toast.className = 'jj-toast' + (type ? ' jj-toast--' + type : '');
        if (text)  { text.className = 'jj-status-text' + (type ? ' jj-status-text--' + type : ''); text.textContent = msg; }
    }

    // ── Panel drag ──
    function savePos(x, y) { localStorage.setItem(STORAGE_POS, JSON.stringify({ x, y })); }
    function getPos()       { try { return JSON.parse(localStorage.getItem(STORAGE_POS) || 'null'); } catch { return null; } }
    function setCollapsed(c){ localStorage.setItem(STORAGE_COLLAPSED, c ? '1' : '0'); }
    function getCollapsed() { return localStorage.getItem(STORAGE_COLLAPSED) === '1'; }

    function clampPos(x, y, w, h) {
        return {
            x: Math.max(0, Math.min(window.innerWidth  - w, x)),
            y: Math.max(0, Math.min(window.innerHeight - h, y)),
        };
    }

    function makeDraggable(el, handle) {
        let dragging = false, ox = 0, oy = 0, moved = false;
        handle.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            dragging = true; moved = false;
            const r = el.getBoundingClientRect();
            ox = e.clientX - r.left; oy = e.clientY - r.top; e.preventDefault();
        });
        document.addEventListener('mousemove', e => {
            if (!dragging) return; moved = true;
            const x = Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  e.clientX - ox));
            const y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, e.clientY - oy));
            el.style.left = x + 'px'; el.style.top = y + 'px';
            el.style.right = 'auto'; el.style.bottom = 'auto';
        });
        document.addEventListener('mouseup', e => {
            if (!dragging) return; dragging = false;
            if (moved) { const r = el.getBoundingClientRect(); savePos(r.left, r.top); e.stopImmediatePropagation(); }
        }, true);
        handle._wasMoved = () => moved;
    }

    // ── UI ──
    function createUI() {
        if (document.getElementById(PANEL_ID)) return;

        const style = document.createElement('style');
        style.textContent = `
    * { box-sizing: border-box; }
    #${PANEL_ID} {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
        width: 268px; background: rgba(250,250,252,0.92); color: #1f2937;
        border-radius: 18px; box-shadow: 0 14px 40px rgba(15,23,42,0.16);
        border: 1px solid rgba(148,163,184,0.18);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; user-select: none; overflow: hidden;
    }
    #${PANEL_ID} .jj-header {
        display: flex; align-items: center; justify-content: space-between; padding: 12px 14px;
        background: linear-gradient(180deg, rgba(255,255,255,0.75), rgba(248,250,252,0.65));
        cursor: grab; border-bottom: 1px solid rgba(148,163,184,0.14);
    }
    #${PANEL_ID} .jj-header:active { cursor: grabbing; }
    #${PANEL_ID} .jj-title { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #475569; }
    #${PANEL_ID} .jj-collapse-btn {
        width: 24px; height: 24px; background: rgba(148,163,184,0.14); border: none;
        border-radius: 8px; color: #64748b; font-size: 14px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
    }
    #${PANEL_ID} .jj-body { padding: 12px; display: flex; flex-direction: column; gap: 9px; }
    #${PANEL_ID} .jj-section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; padding: 0 2px; }
    #${PANEL_ID} .jj-btn {
        width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.92); color: #0f172a;
        font-size: 13px; font-weight: 600; border: 1px solid rgba(203,213,225,0.9);
        border-radius: 12px; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 10px;
        transition: background 0.15s, border-color 0.15s, transform 0.15s;
    }
    #${PANEL_ID} .jj-btn:hover:not(:disabled) { background: #fff; border-color: rgba(148,163,184,0.9); transform: translateY(-1px); }
    #${PANEL_ID} .jj-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    #${PANEL_ID} .jj-btn.jj-wip { opacity: 0.4; cursor: not-allowed; }
    #${PANEL_ID} .jj-btn .jj-btn-icon {
        width: 22px; height: 22px; background: linear-gradient(180deg, #e2e8f0, #cbd5e1);
        color: #334155; border-radius: 7px; display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; flex-shrink: 0; border: 1px solid rgba(148,163,184,0.35);
    }
    #${PANEL_ID} .jj-wip-badge {
        margin-left: auto; font-size: 10px; font-weight: 600; color: #94a3b8;
        background: rgba(148,163,184,0.12); border-radius: 6px; padding: 2px 6px;
    }
    #${PANEL_ID} .jj-toast { height: 3px; width: 100%; background: transparent; transition: background 0.25s; }
    #${PANEL_ID} .jj-toast--running { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    #${PANEL_ID} .jj-toast--done    { background: linear-gradient(90deg, #34d399, #10b981); }
    #${PANEL_ID} .jj-toast--error   { background: linear-gradient(90deg, #fb7185, #ef4444); }
    #${PANEL_ID} .jj-status-text { font-size: 11px; color: #94a3b8; padding: 2px 2px 4px; min-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #${PANEL_ID} .jj-status-text--running { color: #d97706; }
    #${PANEL_ID} .jj-status-text--done    { color: #059669; }
    #${PANEL_ID} .jj-status-text--error   { color: #dc2626; }
    #${PANEL_ID} .jj-logout-btn {
        width: 100%; padding: 7px 12px; background: transparent; color: #94a3b8;
        font-size: 11px; font-weight: 500; border: 1px solid rgba(203,213,225,0.6);
        border-radius: 10px; cursor: pointer; text-align: center;
    }
    #${PANEL_ID} .jj-logout-btn:hover { color: #ef4444; border-color: rgba(239,68,68,0.4); }
    #${MINI_ID} {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
        width: 46px; height: 46px; background: rgba(255,255,255,0.92); color: #334155;
        border-radius: 50%; box-shadow: 0 8px 24px rgba(15,23,42,0.18);
        border: 1px solid rgba(148,163,184,0.2); cursor: pointer;
        display: none; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 10px; font-weight: 700; letter-spacing: 0.05em; user-select: none;
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    }
        `;
        document.head.appendChild(style);

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="jj-header">
                <span class="jj-title">Cezanne Exporter</span>
                <button class="jj-collapse-btn" id="jj-collapse-btn" title="Minimizar">−</button>
            </div>
            <div id="jj-toast" class="jj-toast"></div>
            <div class="jj-body">
                <div class="jj-section-label">Plantillas</div>

                <button class="jj-btn" id="jj-btn-maestro">
                    <span class="jj-btn-icon">↓</span>
                    <span>Maestro de empleados</span>
                </button>

                <button class="jj-btn jj-wip" disabled title="Próximamente">
                    <span class="jj-btn-icon">↓</span>
                    <span>Empleados Activos</span>
                    <span class="jj-wip-badge">En desarrollo</span>
                </button>

                <button class="jj-btn jj-wip" disabled title="Próximamente">
                    <span class="jj-btn-icon">↓</span>
                    <span>Revisión Médica 2025</span>
                    <span class="jj-wip-badge">En desarrollo</span>
                </button>

                <div id="jj-status-text" class="jj-status-text">Listo</div>
                <button class="jj-logout-btn" id="jj-logout-btn">Cerrar sesión</button>
            </div>`;

        const mini = document.createElement('div');
        mini.id = MINI_ID;
        mini.innerHTML = 'EX';

        document.body.appendChild(panel);
        document.body.appendChild(mini);

        const pos = getPos();
        if (pos) {
            const { x, y } = clampPos(pos.x, pos.y, 268, 200);
            [panel, mini].forEach(el => {
                el.style.left = x + 'px'; el.style.top = y + 'px';
                el.style.right = 'auto'; el.style.bottom = 'auto';
            });
        }

        let collapsed = getCollapsed();

        function collapsePanel() {
            const r = panel.getBoundingClientRect();
            mini.style.left = r.left + 'px'; mini.style.top = r.top + 'px';
            mini.style.right = 'auto'; mini.style.bottom = 'auto';
            panel.style.display = 'none'; mini.style.display = 'flex';
            collapsed = true; setCollapsed(true);
        }
        function expandPanel() {
            const r = mini.getBoundingClientRect();
            panel.style.left = r.left + 'px'; panel.style.top = r.top + 'px';
            panel.style.right = 'auto'; panel.style.bottom = 'auto';
            mini.style.display = 'none'; panel.style.display = '';
            collapsed = false; setCollapsed(false);
        }

        panel.querySelector('#jj-collapse-btn').addEventListener('mouseup', () => {
            if (panel.querySelector('.jj-header')._wasMoved?.()) return;
            collapsePanel();
        });
        mini.addEventListener('mouseup', () => {
            if (mini._wasMoved?.()) return;
            expandPanel();
        });

        panel.querySelector('#jj-logout-btn').addEventListener('click', () => {
            clearToken(); authVerified = false; setStatus('', 'Listo');
        });

        panel.querySelector('#jj-btn-maestro').addEventListener('click', () => {
            if (window.__jj_export_running) { setStatus('running', 'Tarea en curso, espera…'); return; }
            ensureAuth(() => runExportFlow());
        });

        makeDraggable(panel, panel.querySelector('.jj-header'));
        makeDraggable(mini, mini);
        if (collapsed) collapsePanel();
    }

    function initWhenReady() {
        if (!document.body) { setTimeout(initWhenReady, 500); return; }
        createUI();
    }
    initWhenReady();
})();
