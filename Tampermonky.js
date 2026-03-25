(function () {
    'use strict';

    // ── Configuración ──
    const AUTH_URL          = 'https://crimson-breeze-86fb.jy734933371.workers.dev';
    const PANEL_ID          = 'jj-export-panel';
    const MINI_ID           = 'jj-export-mini';
    const STORAGE_POS       = 'jj_export_panel_pos';
    const STORAGE_COLLAPSED = 'jj_export_panel_collapsed';
    const INFORME_HREF      = '/CezanneHR/-/IQS/node/cf2ce6e3-6382-444c-800d-ea1502e71db5';

    // ── Autorización ──
    function getStoredToken() { return GM_getValue('jj_auth_token', ''); }
    function saveToken(t)     { GM_setValue('jj_auth_token', t); }

    function verifyToken(token) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${AUTH_URL}?token=${encodeURIComponent(token)}`,
                timeout: 8000,
                onload(res) {
                    try { resolve(JSON.parse(res.responseText).ok === true); }
                    catch { resolve(false); }
                },
                onerror()   { resolve(false); },
                ontimeout() { resolve(false); },
            });
        });
    }

    // ── Diálogo de autorización (se abre al hacer clic en un botón) ──
    function showAuthDialog(onSuccess) {
        if (document.getElementById('jj-auth-overlay')) return;

        GM_addStyle(`
            #jj-auth-overlay {
                position: fixed; inset: 0; z-index: 2147483646;
                background: rgba(15,23,42,0.45);
                backdrop-filter: blur(6px);
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
                width: 100%; padding: 9px;
                background: transparent; color: #94a3b8;
                border: 1px solid rgba(203,213,225,0.6); border-radius: 10px;
                font-size: 13px; cursor: pointer;
                transition: color 0.15s, border-color 0.15s;
            }
            #jj-auth-cancel:hover { color: #475569; border-color: #94a3b8; }
            #jj-auth-submit {
                width: 100%; padding: 11px;
                background: #0f172a; color: #fff;
                border: none; border-radius: 10px;
                font-size: 14px; font-weight: 600; cursor: pointer;
                transition: background 0.15s, transform 0.1s;
            }
            #jj-auth-submit:hover    { background: #1e293b; }
            #jj-auth-submit:active   { transform: scale(0.98); }
            #jj-auth-submit:disabled { background: #94a3b8; cursor: not-allowed; }
        `);

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
            if (ok) {
                saveToken(token); overlay.remove(); onSuccess();
            } else {
                btn.disabled = false; btn.textContent = 'Verificar';
                input.classList.add('error'); errMsg.style.display = 'block'; input.focus();
            }
        }

        btn.addEventListener('click', attempt);
        cancel.addEventListener('click', () => overlay.remove());
        input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
        // Cerrar al hacer clic fuera del cuadro
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        input.focus();
    }

    // ── Lógica de exportación ──
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function normalizeText(text) { return (text || '').replace(/\s+/g, ' ').trim(); }

    function isVisible(el) {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' &&
               (el.offsetParent !== null || s.position === 'fixed');
    }

    async function waitFor(fn, timeout = 20000, interval = 300, errorMsg = 'Tiempo de espera agotado') {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const result = fn(); if (result) return result;
            await sleep(interval);
        }
        throw new Error(errorMsg);
    }

    async function navigateToInforme() {
        let link = document.querySelector(`a[href="${INFORME_HREF}"], a[id="navLink-cf2ce6e3-6382-444c-800d-ea1502e71db5"]`);
        if (!link) {
            const sideIcon = document.querySelector('a[title="Informes y Analíticas"], a[id="navLink-9be6b119-d395-4322-8a0b-9dc8ba2f84f4"]');
            if (sideIcon) { sideIcon.click(); await sleep(1500); }
            link = await waitFor(
                () => document.querySelector(`a[href="${INFORME_HREF}"], a[id="navLink-cf2ce6e3-6382-444c-800d-ea1502e71db5"]`),
                10000, 300, 'No se encontró el enlace Informe Resumen de Personas'
            );
        }
        link.click();
        await waitFor(
            () => Array.from(document.querySelectorAll('button'))
                       .find(b => normalizeText(b.textContent) === 'Utilizar Plantilla Existente' && isVisible(b)),
            20000, 300, 'Tiempo de espera agotado al cargar la página'
        );
        await sleep(500);
    }

    async function clickUsarPlantilla() {
        const btn = await waitFor(() =>
            Array.from(document.querySelectorAll('button'))
                 .find(b => normalizeText(b.textContent) === 'Utilizar Plantilla Existente' && isVisible(b)),
            15000, 300, 'No se encontró el botón «Utilizar Plantilla Existente»'
        );
        btn.click(); await sleep(1500);
    }

    function isPanelOpen() {
        return !!document.querySelector('.cdk-overlay-pane mat-option, .cdk-overlay-pane .mat-mdc-option');
    }

    async function openTemplateDropdown() {
        const matSelect = await waitFor(() =>
            Array.from(document.querySelectorAll('mat-select')).find(el => {
                const ph = el.querySelector('.mat-mdc-select-placeholder');
                return ph && isVisible(el) && normalizeText(ph.textContent).includes('Por Favor Seleccione');
            }),
            20000, 300, 'No se encontró el desplegable de plantillas'
        );
        const trigger = matSelect.querySelector('.mat-mdc-select-trigger') || matSelect;
        matSelect.focus(); await sleep(200); trigger.click(); await sleep(600);
        if (isPanelOpen()) return;
        ['keydown','keyup'].forEach(type => matSelect.dispatchEvent(
            new KeyboardEvent(type, { key:' ', code:'Space', keyCode:32, bubbles:true, cancelable:true })
        ));
        await sleep(600); if (isPanelOpen()) return;
        for (const type of ['pointerdown','mousedown','pointerup','mouseup','click'])
            trigger.dispatchEvent(new MouseEvent(type, { bubbles:true, cancelable:true, composed:true, view:window }));
        await waitFor(isPanelOpen, 8000, 300, 'No se pudo abrir el desplegable de plantillas');
    }

    async function clickButton(text, label) {
        const btn = await waitFor(() =>
            Array.from(document.querySelectorAll('button'))
                 .find(b => normalizeText(b.textContent) === text && isVisible(b) && !b.disabled),
            20000, 300, `No se encontró el botón: ${label || text}`
        );
        btn.click(); await sleep(1800);
    }

    const TEMPLATES = [
        { label: 'Maestro de empleados', name: 'Maestro de empleados (People & Organization)' },
        { label: 'Empleados Activos',    name: 'Empleados Activos' },
        { label: 'Revisión Médica 2025', name: 'Revisión Médica 2025' },
    ];

    async function runExportFlow(templateName) {
        try {
            window.__jj_export_running = true;
            setStatus('running', `Exportando: ${templateName}`);
            await navigateToInforme();
            await clickUsarPlantilla();
            await openTemplateDropdown();
            const option = await waitFor(() =>
                Array.from(document.querySelectorAll('.cdk-overlay-pane mat-option, .cdk-overlay-pane .mat-mdc-option'))
                     .find(el => normalizeText(el.textContent) === templateName && isVisible(el)),
                15000, 300, `No se encontró la opción: ${templateName}`
            );
            option.click(); await sleep(1500);
            await clickButton('Próximo', 'Próximo (1ª vez)');
            await clickButton('Próximo', 'Próximo (2ª vez)');
            await clickButton('Guardar y Exportar');
            setStatus('done', '✅ Exportación completada');
        } catch (err) {
            console.error(err);
            setStatus('error', `❌ ${err.message}`);
        } finally {
            window.__jj_export_running = false;
        }
    }

    // ── UI ──
    function setStatus(type, msg) {
        const toast = document.querySelector('#jj-toast');
        const text  = document.querySelector('#jj-status-text');
        if (toast) toast.className = 'jj-toast' + (type ? ' jj-toast--' + type : '');
        if (text)  { text.className = 'jj-status-text' + (type ? ' jj-status-text--' + type : ''); text.textContent = msg; }
    }

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

    // ── Verificación y arranque ──
    // El token se verifica la primera vez que el usuario pulsa un botón de exportación.
    // Si ya hay un token guardado y válido, el panel se muestra directamente.
    // Si el token es inválido o no existe, se abre el diálogo al hacer clic.
    let authVerified = false;

    async function ensureAuth(onSuccess) {
        // Ya verificado en esta sesión
        if (authVerified) { onSuccess(); return; }

        const token = getStoredToken();
        if (token) {
            setStatus('running', 'Verificando autorización…');
            const ok = await verifyToken(token);
            if (ok) { authVerified = true; setStatus('', 'Listo'); onSuccess(); return; }
            // Token revocado
            saveToken('');
            setStatus('error', 'Código revocado. Vuelve a autorizarte.');
        }
        // Sin token o token inválido → abrir diálogo
        showAuthDialog(() => { authVerified = true; onSuccess(); });
    }

    function createUI() {
        if (document.getElementById(PANEL_ID)) return;

        GM_addStyle(`
    * { box-sizing: border-box; }
    #${PANEL_ID} {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
        width: 268px; background: rgba(250,250,252,0.92); color: #1f2937;
        border-radius: 18px; box-shadow: 0 14px 40px rgba(15,23,42,0.16);
        border: 1px solid rgba(148,163,184,0.18);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px; user-select: none; overflow: hidden; transition: box-shadow 0.2s;
    }
    #${PANEL_ID}:hover { box-shadow: 0 18px 48px rgba(15,23,42,0.22); }
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
        transition: background 0.15s, color 0.15s, transform 0.15s;
    }
    #${PANEL_ID} .jj-collapse-btn:hover { background: rgba(148,163,184,0.24); color: #334155; transform: translateY(-1px); }
    #${PANEL_ID} .jj-body { padding: 12px; display: flex; flex-direction: column; gap: 9px; }
    #${PANEL_ID} .jj-section-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; padding: 0 2px; }
    #${PANEL_ID} .jj-btn {
        width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.92); color: #0f172a;
        font-size: 13px; font-weight: 600; border: 1px solid rgba(203,213,225,0.9);
        border-radius: 12px; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 10px;
        transition: background 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s;
    }
    #${PANEL_ID} .jj-btn:hover { background: #fff; border-color: rgba(148,163,184,0.9); transform: translateY(-1px); box-shadow: 0 6px 16px rgba(148,163,184,0.16); }
    #${PANEL_ID} .jj-btn:active { transform: translateY(0); box-shadow: none; }
    #${PANEL_ID} .jj-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
    #${PANEL_ID} .jj-btn .jj-btn-icon {
        width: 22px; height: 22px; background: linear-gradient(180deg, #e2e8f0, #cbd5e1);
        color: #334155; border-radius: 7px; display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; flex-shrink: 0; border: 1px solid rgba(148,163,184,0.35);
    }
    #${PANEL_ID} .jj-toast { height: 3px; width: 100%; background: transparent; transition: background 0.25s; }
    #${PANEL_ID} .jj-toast--running { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    #${PANEL_ID} .jj-toast--done    { background: linear-gradient(90deg, #34d399, #10b981); }
    #${PANEL_ID} .jj-toast--error   { background: linear-gradient(90deg, #fb7185, #ef4444); }
    #${PANEL_ID} .jj-status-text { font-size: 11px; color: #94a3b8; padding: 2px 2px 4px; min-height: 16px; transition: color 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #${PANEL_ID} .jj-status-text--running { color: #d97706; }
    #${PANEL_ID} .jj-status-text--done    { color: #059669; }
    #${PANEL_ID} .jj-status-text--error   { color: #dc2626; }
    #${PANEL_ID} .jj-logout-btn {
        width: 100%; padding: 7px 12px; background: transparent; color: #94a3b8;
        font-size: 11px; font-weight: 500; border: 1px solid rgba(203,213,225,0.6);
        border-radius: 10px; cursor: pointer; text-align: center;
        transition: color 0.15s, border-color 0.15s, background 0.15s;
    }
    #${PANEL_ID} .jj-logout-btn:hover { color: #ef4444; border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.04); }
    #${MINI_ID} {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
        width: 46px; height: 46px; background: rgba(255,255,255,0.92); color: #334155;
        border-radius: 50%; box-shadow: 0 8px 24px rgba(15,23,42,0.18);
        border: 1px solid rgba(148,163,184,0.2); cursor: pointer;
        display: none; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 10px; font-weight: 700; letter-spacing: 0.05em; user-select: none;
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        transition: transform 0.15s, box-shadow 0.15s;
    }
    #${MINI_ID}:hover { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(15,23,42,0.22); }
`);

        const btnsHTML = TEMPLATES.map((t, i) => `
            <button class="jj-btn" data-idx="${i}">
                <span class="jj-btn-icon">↓</span>
                <span>${t.label}</span>
            </button>`).join('');

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
                ${btnsHTML}
                <div id="jj-status-text" class="jj-status-text">Listo</div>
                <button class="jj-logout-btn" id="jj-logout-btn">Cerrar sesión</button>
            </div>`;

        const mini = document.createElement('div');
        mini.id = MINI_ID; mini.innerHTML = 'EX';

        document.body.appendChild(panel);
        document.body.appendChild(mini);

        // Restaurar posición (ajustada al viewport actual)
        const pos = getPos();
        if (pos) {
            const { x, y } = clampPos(pos.x, pos.y, 268, 200);
            [panel, mini].forEach(el => {
                el.style.left = x + 'px'; el.style.top = y + 'px';
                el.style.right = 'auto'; el.style.bottom = 'auto';
            });
            if (x !== pos.x || y !== pos.y) savePos(x, y);
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

        // Cerrar sesión
        panel.querySelector('#jj-logout-btn').addEventListener('click', () => {
            saveToken(''); authVerified = false;
            setStatus('', 'Listo');
        });

        // Botones de exportación → verificar autorización antes de ejecutar
        panel.querySelectorAll('.jj-btn[data-idx]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (window.__jj_export_running) { setStatus('running', 'Tarea en curso, espera un momento'); return; }
                ensureAuth(() => runExportFlow(TEMPLATES[parseInt(btn.dataset.idx)].name));
            });
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
