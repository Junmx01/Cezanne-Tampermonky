// ==UserScript==
// @name         Cezanne - Exportar Maestro de empleados
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Exportador con perfiles por usuario, botón de cancelar y ajustes de UI
// @match        *://*/CezanneHR/*
// @match        https://w3.cezanneondemand.com/*
// @grant        GM_addStyle
// @connect      crimson-breeze-86fb.jy734933371.workers.dev
// @updateURL    https://raw.githubusercontent.com/Junmx01/Cezanne-Tampermonky/main/cezanne-export.user.js
// @downloadURL  https://raw.githubusercontent.com/Junmx01/Cezanne-Tampermonky/main/cezanne-export.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ════════════════════════════════════════════════════════════════
    //  CONFIGURACIÓN DE PERFILES
    //  · Añadir persona  → nueva entrada en PROFILES
    //  · Quitar botón    → eliminar su id del array buttons[]
    //  · Worker debe devolver { ok: true, role: "<clave>" }
    //    donde <clave> es exactamente el nombre de la propiedad aquí
    //
    //  IDs de botón disponibles: 'maestro' | 'activos' | 'revision'
    //  color:  'admin' (morado) | 'user' (gris estándar)
    // ════════════════════════════════════════════════════════════════
    const PROFILES = {
        // ── Admin ──────────────────────────────────────────────
        'junjie': { label: 'Admin',  color: 'admin', buttons: ['maestro', 'activos', 'revision'] },

        // ── Usuarios ───────────────────────────────────────────
        // Cambia buttons[] para cada persona según lo que necesite
        // IDs disponibles: 'maestro' | 'activos' | 'revision'
        'emilio': { label: 'Emilio', color: 'user',  buttons: ['maestro'] },
        'merce':  { label: 'Mercè',  color: 'user',  buttons: ['maestro'] },
        'luisa':  { label: 'Luisa',  color: 'user',  buttons: ['maestro'] },
        'carlos': { label: 'Carlos', color: 'user',  buttons: ['maestro'] },
        'eva':    { label: 'Eva',    color: 'user',  buttons: ['maestro'] },
    };

    // ════════════════════════════════════════════════════════════════
    //  CONSTANTES INTERNAS
    // ════════════════════════════════════════════════════════════════
    const AUTH_URL          = 'https://crimson-breeze-86fb.jy734933371.workers.dev';
    const PANEL_ID          = 'jj-export-panel';
    const MINI_ID           = 'jj-export-mini';
    const STORAGE_POS       = 'jj_export_panel_pos';
    const STORAGE_COLLAPSED = 'jj_export_panel_collapsed';
    const STORAGE_TOKEN     = 'jj_auth_token';
    const STORAGE_PROFILE   = 'jj_auth_profile';
    const STORAGE_THEME     = 'jj_theme';
    const INFORME_HREF      = '/CezanneHR/-/IQS/node/cf2ce6e3-6382-444c-800d-ea1502e71db5';
    const TARGET_TEMPLATE   = 'Maestro de empleados (People & Organization)';

    // ── Auth / Perfil ──
    function getStoredToken()   { return localStorage.getItem(STORAGE_TOKEN)   || ''; }
    function saveToken(t)       { localStorage.setItem(STORAGE_TOKEN, t); }
    function clearToken()       { localStorage.removeItem(STORAGE_TOKEN); }
    function saveProfile(p)     { localStorage.setItem(STORAGE_PROFILE, p); }
    function getStoredProfile() { return localStorage.getItem(STORAGE_PROFILE) || ''; }
    function clearProfile()     { localStorage.removeItem(STORAGE_PROFILE); }

    // ── Tema ──
    function getTheme()   { return localStorage.getItem(STORAGE_THEME) || 'light'; }
    function saveTheme(t) { localStorage.setItem(STORAGE_THEME, t); }

    // ── verifyToken → devuelve clave de perfil o null ──
    async function verifyToken(token) {
        try {
            const res  = await fetch(`${AUTH_URL}?token=${encodeURIComponent(token)}`);
            const data = await res.json();
            if (data.ok === true) return data.role || null;
            return null;
        } catch { return null; }
    }

    function showAuthDialog(onSuccess) {
        if (document.getElementById('jj-auth-overlay')) return;
        const isDark = getTheme() === 'dark';
        const style = document.createElement('style');
        style.id = 'jj-auth-style';
        style.textContent = `
            #jj-auth-overlay {
                position:fixed; inset:0; z-index:2147483646;
                background:rgba(15,23,42,0.5); backdrop-filter:blur(6px);
                display:flex; align-items:center; justify-content:center;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            }
            #jj-auth-box {
                background:${isDark ? '#1e293b' : '#fff'}; border-radius:20px;
                padding:32px 28px 24px; width:320px;
                box-shadow:0 24px 60px rgba(15,23,42,0.28);
                display:flex; flex-direction:column; gap:16px;
                border:1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
            }
            #jj-auth-box h2 { margin:0; font-size:16px; font-weight:700; color:${isDark ? '#f1f5f9' : '#0f172a'}; }
            #jj-auth-box p  { margin:0; font-size:13px; color:${isDark ? '#94a3b8' : '#64748b'}; line-height:1.5; }
            #jj-auth-input {
                width:100%; padding:10px 12px;
                border:1.5px solid ${isDark ? '#334155' : '#cbd5e1'}; border-radius:10px;
                font-size:14px; color:${isDark ? '#f1f5f9' : '#0f172a'};
                background:${isDark ? '#0f172a' : '#fff'}; outline:none;
                transition:border-color 0.15s; box-sizing:border-box;
            }
            #jj-auth-input:focus { border-color:#94a3b8; }
            #jj-auth-input.error { border-color:#ef4444; }
            #jj-auth-err { font-size:12px; color:#ef4444; margin:-8px 0 0; display:none; }
            #jj-auth-cancel {
                width:100%; padding:9px; background:transparent;
                color:${isDark ? '#64748b' : '#94a3b8'};
                border:1px solid ${isDark ? 'rgba(100,116,139,0.4)' : 'rgba(203,213,225,0.6)'};
                border-radius:10px; font-size:13px; cursor:pointer;
            }
            #jj-auth-submit {
                width:100%; padding:11px;
                background:${isDark ? '#f1f5f9' : '#0f172a'};
                color:${isDark ? '#0f172a' : '#fff'};
                border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer;
            }
            #jj-auth-submit:disabled { background:#94a3b8; cursor:not-allowed; }
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
            const profileKey = await verifyToken(token);
            if (profileKey && PROFILES[profileKey]) {
                saveToken(token); saveProfile(profileKey);
                overlay.remove(); style.remove();
                onSuccess(profileKey);
            } else {
                btn.disabled = false; btn.textContent = 'Verificar';
                input.classList.add('error'); errMsg.style.display = 'block'; input.focus();
            }
        }
        btn.addEventListener('click', attempt);
        cancel.addEventListener('click', () => { overlay.remove(); style.remove(); });
        input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
        overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); style.remove(); } });
        input.focus();
    }

    // ── Utilidades ──
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function norm(el)  { return (el?.textContent || '').replace(/\s+/g, ' ').trim(); }
    function isVisible(el) {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' &&
               (el.offsetParent !== null || s.position === 'fixed');
    }
    async function waitFor(fn, timeout = 25000, interval = 400, msg = 'Tiempo de espera agotado') {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            checkAbort();
            const r = fn(); if (r) return r;
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

    // ── Cancelación ──
    function checkAbort() {
        if (window.__jj_export_abort) throw new Error('Cancelado por el usuario');
    }

    // ── Pasos del flujo ──
    async function paso1_navegar() {
        setStatus('running', 'Paso 1/6: Navegando al informe…');
        if (findButton('Utilizar Plantilla Existente')) return;
        let link = document.querySelector(
            `a[href="${INFORME_HREF}"], a[id="navLink-cf2ce6e3-6382-444c-800d-ea1502e71db5"]`
        );
        if (!link) {
            const menuIcon = document.querySelector(
                'a[title="Informes y Analíticas"], a[id="navLink-9be6b119-d395-4322-8a0b-9dc8ba2f84f4"], #ea96f17f-06cc-4493-a0d8-f527aaf01d9c'
            );
            if (!menuIcon) throw new Error('No se encontró el menú lateral "Informes y Analíticas"');
            menuIcon.click(); await sleep(1500); checkAbort();
            link = await waitFor(
                () => document.querySelector(`a[href="${INFORME_HREF}"], a[id="navLink-cf2ce6e3-6382-444c-800d-ea1502e71db5"]`),
                10000, 300, 'No se encontró "Informe Resumen de Personas" en el menú'
            );
        }
        link.click();
        await waitFor(() => findButton('Utilizar Plantilla Existente'), 25000, 400, 'La página del informe tardó demasiado en cargar');
        await sleep(400); checkAbort();
    }
    async function paso2_usarPlantilla() {
        setStatus('running', 'Paso 2/6: Abriendo plantillas…');
        await clickButton('Utilizar Plantilla Existente');
        await waitFor(
            () => document.querySelector('mat-select, [role="combobox"]') &&
                  isVisible(document.querySelector('mat-select, [role="combobox"]')),
            15000, 300, 'No apareció el desplegable de plantillas'
        );
        await sleep(600); checkAbort();
    }
    async function paso3_seleccionarPlantilla() {
        setStatus('running', 'Paso 3/6: Seleccionando plantilla…');
        const matSelect = await waitFor(
            () => Array.from(document.querySelectorAll('mat-select')).find(el => isVisible(el)),
            15000, 300, 'No se encontró el desplegable mat-select'
        );
        const trigger = matSelect.querySelector('.mat-mdc-select-trigger') || matSelect;
        matSelect.focus(); await sleep(200); checkAbort(); trigger.click(); await sleep(800); checkAbort();
        const panelOpen = () => !!document.querySelector('.cdk-overlay-pane mat-option, .cdk-overlay-pane .mat-mdc-option');
        if (!panelOpen()) {
            ['keydown','keyup'].forEach(type =>
                matSelect.dispatchEvent(new KeyboardEvent(type, { key:' ', code:'Space', keyCode:32, bubbles:true, cancelable:true }))
            );
            await sleep(600); checkAbort();
        }
        if (!panelOpen()) {
            for (const type of ['pointerdown','mousedown','pointerup','mouseup','click'])
                trigger.dispatchEvent(new MouseEvent(type, { bubbles:true, cancelable:true, composed:true, view:window }));
            await waitFor(panelOpen, 8000, 300, 'No se pudo abrir el desplegable de plantillas');
        }
        const option = await waitFor(
            () => Array.from(document.querySelectorAll('.cdk-overlay-pane mat-option, .cdk-overlay-pane .mat-mdc-option'))
                       .find(el => norm(el) === TARGET_TEMPLATE && isVisible(el)),
            10000, 300, `No se encontró la opción "${TARGET_TEMPLATE}"`
        );
        option.click(); await sleep(800); checkAbort();
    }
    async function paso4_proximoUno() {
        setStatus('running', 'Paso 4/6: Avanzando (1/2)…');
        await clickButton('Próximo'); await sleep(1500); checkAbort();
    }
    async function paso5_checkboxYproximo() {
        setStatus('running', 'Paso 5/6: Verificando opciones…');
        const checkbox = await waitFor(() => {
            const byLabel = document.querySelector('input[type="checkbox"][aria-label="Automatización para datos de entrada y salida"]');
            if (byLabel && isVisible(byLabel)) return byLabel;
            return Array.from(document.querySelectorAll('input[type="checkbox"][kendocheckbox], input.k-checkbox'))
                .find(el => isVisible(el));
        }, 20000, 400, 'No apareció el checkbox de opciones');
        if (!checkbox.checked) { checkbox.click(); await sleep(400); checkAbort(); }
        await clickButton('Próximo');
        await waitFor(
            () => document.querySelector('#criteria-builder-operator-all') || findButton('Guardar y Exportar'),
            30000, 500, 'La página de criterios tardó demasiado en cargar'
        );
        await sleep(600); checkAbort();
    }
    async function paso6_guardar() {
        setStatus('running', 'Paso 6/6: Exportando…');
        await clickButton('Guardar y Exportar');
        await sleep(1000);
        setStatus('done', '✅ Exportación completada');
    }

    async function runExportFlow() {
        window.__jj_export_abort   = false;
        window.__jj_export_running = true;
        setRunningUI(true);
        try {
            await paso1_navegar(); await paso2_usarPlantilla(); await paso3_seleccionarPlantilla();
            await paso4_proximoUno(); await paso5_checkboxYproximo(); await paso6_guardar();
        } catch (err) {
            if (err.message === 'Cancelado por el usuario') {
                setStatus('', 'Cancelado');
            } else {
                console.error('[Cezanne Exporter]', err);
                setStatus('error', `❌ ${err.message}`);
            }
        } finally {
            window.__jj_export_running = false;
            window.__jj_export_abort   = false;
            setRunningUI(false);
        }
    }

    // ── Auth flow ──
    let authVerified = false;
    async function ensureAuth(onSuccess) {
        if (authVerified) { onSuccess(getStoredProfile()); return; }
        const token = getStoredToken();
        if (token) { authVerified = true; onSuccess(getStoredProfile()); return; }
        showAuthDialog((profileKey) => { authVerified = true; onSuccess(profileKey); });
    }

    // ── Aplicar perfil → muestra solo los botones del usuario ──
    function applyProfile(profileKey) {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return;

        const profile = PROFILES[profileKey];
        if (!profile) return;

        // Actualizar etiqueta de nombre
        const roleTag = panel.querySelector('#jj-role-tag');
        if (roleTag) {
            roleTag.textContent = profile.label;
            roleTag.className = 'jj-role-tag' + (profile.color === 'admin' ? ' jj-role-admin' : '');
        }

        // Mostrar/ocultar botones según el perfil
        const allBtns = {
            maestro:  panel.querySelector('#jj-btn-maestro'),
            activos:  panel.querySelector('#jj-btn-activos'),
            revision: panel.querySelector('#jj-btn-revision'),
        };
        Object.entries(allBtns).forEach(([id, btn]) => {
            if (!btn) return;
            if (profile.buttons.includes(id)) {
                btn.style.display = '';    // visible
                btn.disabled = false;
                btn.classList.remove('jj-wip');
                btn.querySelector('.jj-wip-badge')?.remove();
            } else {
                btn.style.display = 'none'; // oculto
            }
        });
    }

    // ── UI de estado running / idle ──
    function setRunningUI(running) {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return;
        const allBtns = panel.querySelectorAll('.jj-btn');
        if (running) {
            allBtns.forEach(b => { b.disabled = true; });
        } else {
            const pk = getStoredProfile();
            if (pk && PROFILES[pk]) applyProfile(pk);
        }
    }

    // ── Status bar ──
    function setStatus(type, msg) {
        const toast = document.querySelector('#jj-toast');
        const text  = document.querySelector('#jj-status-text');
        if (toast) toast.className = 'jj-toast' + (type ? ' jj-toast--' + type : '');
        if (text)  { text.className = 'jj-status-text' + (type ? ' jj-status-text--' + type : ''); text.textContent = msg; }
    }

    // ── Tema ──
    function applyTheme(theme) {
        const panel = document.getElementById(PANEL_ID);
        const mini  = document.getElementById(MINI_ID);
        if (!panel) return;
        panel.setAttribute('data-theme', theme);
        if (mini) mini.setAttribute('data-theme', theme);
        const toggle = panel.querySelector('#jj-theme-toggle');
        if (toggle) {
            const isDark = theme === 'dark';
            toggle.setAttribute('data-checked', isDark ? 'true' : 'false');
            toggle.querySelector('.jj-toggle-knob').style.transform = isDark ? 'translateX(20px)' : 'translateX(0)';
        }
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
    function makeDraggable(el, handle, onRelease) {
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
            if (moved) {
                const r = el.getBoundingClientRect();
                if (onRelease) onRelease(r);
                else savePos(r.left, r.top);
                e.stopImmediatePropagation();
            }
        }, true);
        handle._wasMoved = () => moved;
    }

    // ── Crear UI ──
    function createUI() {
        if (document.getElementById(PANEL_ID)) return;

        const style = document.createElement('style');
        style.textContent = `
    #${PANEL_ID}[data-theme="light"] {
        --bg:           rgba(250,250,252,0.93);
        --bg-header:    linear-gradient(180deg,rgba(255,255,255,0.8),rgba(248,250,252,0.7));
        --bg-btn:       rgba(255,255,255,0.92);
        --bg-btn-hover: #fff;
        --bg-icon:      linear-gradient(180deg,#e2e8f0,#cbd5e1);
        --bg-settings:  rgba(248,250,252,0.98);
        --border:       rgba(148,163,184,0.18);
        --border-btn:   rgba(203,213,225,0.9);
        --border-btn-h: rgba(148,163,184,0.9);
        --border-sep:   rgba(148,163,184,0.14);
        --text:         #1f2937;
        --text-title:   #475569;
        --text-icon:    #334155;
        --text-muted:   #94a3b8;
        --text-label:   #94a3b8;
        --shadow:       0 14px 40px rgba(15,23,42,0.16);
        --toggle-track: #cbd5e1;
        --toggle-on:    #334155;
    }
    #${PANEL_ID}[data-theme="dark"] {
        --bg:           rgba(15,23,42,0.96);
        --bg-header:    linear-gradient(180deg,rgba(30,41,59,0.9),rgba(15,23,42,0.85));
        --bg-btn:       rgba(30,41,59,0.9);
        --bg-btn-hover: rgba(30,41,59,1);
        --bg-icon:      linear-gradient(180deg,#334155,#1e293b);
        --bg-settings:  rgba(10,17,32,0.99);
        --border:       rgba(255,255,255,0.07);
        --border-btn:   rgba(255,255,255,0.1);
        --border-btn-h: rgba(255,255,255,0.2);
        --border-sep:   rgba(255,255,255,0.07);
        --text:         #e2e8f0;
        --text-title:   #94a3b8;
        --text-icon:    #cbd5e1;
        --text-muted:   #475569;
        --text-label:   #475569;
        --shadow:       0 14px 40px rgba(0,0,0,0.5);
        --toggle-track: #334155;
        --toggle-on:    #e2e8f0;
    }
    #${MINI_ID}[data-theme="dark"] {
        background:rgba(15,23,42,0.96) !important;
        color:#e2e8f0 !important;
        border-color:rgba(255,255,255,0.1) !important;
    }
    * { box-sizing:border-box; }
    #${PANEL_ID} {
        position:fixed; right:20px; bottom:20px; z-index:2147483647;
        width:268px; background:var(--bg); color:var(--text);
        border-radius:18px; box-shadow:var(--shadow); border:1px solid var(--border);
        backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:13px; user-select:none; overflow:hidden;
        transition:background 0.25s, box-shadow 0.25s, border-color 0.25s;
    }
    #${PANEL_ID} .jj-header {
        display:flex; align-items:center; justify-content:space-between;
        padding:12px 14px; background:var(--bg-header);
        cursor:grab; border-bottom:1px solid var(--border-sep); gap:6px;
    }
    #${PANEL_ID} .jj-header:active { cursor:grabbing; }
    #${PANEL_ID} .jj-header-left  { display:flex; align-items:center; gap:7px; flex:1; min-width:0; }
    #${PANEL_ID} .jj-header-right { display:flex; align-items:center; gap:4px; flex-shrink:0; }
    #${PANEL_ID} .jj-title {
        font-size:12px; font-weight:700; letter-spacing:0.06em;
        text-transform:uppercase; color:var(--text-title); white-space:nowrap;
    }
    #${PANEL_ID} .jj-role-tag {
        font-size:10px; font-weight:600; color:var(--text-muted);
        background:rgba(148,163,184,0.12); border-radius:6px; padding:2px 7px; white-space:nowrap;
    }
    #${PANEL_ID} .jj-role-tag.jj-role-admin { color:#7c3aed; background:rgba(124,58,237,0.12); }
    #${PANEL_ID} .jj-icon-btn {
        width:26px; height:26px; background:transparent; border:none;
        border-radius:8px; color:var(--text-muted); font-size:14px; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:background 0.15s, color 0.15s; flex-shrink:0;
    }
    #${PANEL_ID} .jj-icon-btn:hover  { background:rgba(148,163,184,0.14); color:var(--text); }
    #${PANEL_ID} .jj-icon-btn.active { background:rgba(148,163,184,0.2);  color:var(--text); }
    #${PANEL_ID} .jj-body { padding:12px; display:flex; flex-direction:column; gap:9px; }
    #${PANEL_ID} .jj-section-label {
        font-size:10px; font-weight:700; letter-spacing:0.08em;
        text-transform:uppercase; color:var(--text-label); padding:0 2px;
    }
    #${PANEL_ID} .jj-btn {
        width:100%; padding:10px 12px; background:var(--bg-btn); color:var(--text);
        font-size:13px; font-weight:600; border:1px solid var(--border-btn);
        border-radius:12px; cursor:pointer; text-align:left;
        display:flex; align-items:center; gap:10px;
        transition:background 0.15s, border-color 0.15s, transform 0.15s;
    }
    #${PANEL_ID} .jj-btn:hover:not(:disabled) { background:var(--bg-btn-hover); border-color:var(--border-btn-h); transform:translateY(-1px); }
    #${PANEL_ID} .jj-btn:disabled { opacity:0.4; cursor:not-allowed; transform:none !important; }
    #${PANEL_ID} .jj-btn .jj-btn-icon {
        width:22px; height:22px; background:var(--bg-icon); color:var(--text-icon);
        border-radius:7px; display:flex; align-items:center; justify-content:center;
        font-size:11px; font-weight:700; flex-shrink:0; border:1px solid rgba(148,163,184,0.25);
    }

    /* Botón cancelar */
    #${PANEL_ID} #jj-cancel-btn {
        display:none;
        width:100%; padding:9px 12px;
        background:rgba(239,68,68,0.08); color:#ef4444;
        font-size:12px; font-weight:600;
        border:1px solid rgba(239,68,68,0.25); border-radius:10px;
        cursor:pointer; text-align:center;
        transition:background 0.15s, border-color 0.15s;
    }
    #${PANEL_ID} #jj-cancel-btn:hover { background:rgba(239,68,68,0.14); border-color:rgba(239,68,68,0.5); }

    #${PANEL_ID} .jj-toast { height:3px; width:100%; background:transparent; transition:background 0.25s; }
    #${PANEL_ID} .jj-toast--running { background:linear-gradient(90deg,#fbbf24,#f59e0b); }
    #${PANEL_ID} .jj-toast--done    { background:linear-gradient(90deg,#34d399,#10b981); }
    #${PANEL_ID} .jj-toast--error   { background:linear-gradient(90deg,#fb7185,#ef4444); }
    #${PANEL_ID} .jj-status-text {
        font-size:11px; color:var(--text-muted); padding:2px 2px 0;
        min-height:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    #${PANEL_ID} .jj-status-text--running { color:#d97706; }
    #${PANEL_ID} .jj-status-text--done    { color:#059669; }
    #${PANEL_ID} .jj-status-text--error   { color:#dc2626; }

    /* Cajón de ajustes */
    #${PANEL_ID} .jj-settings { overflow:hidden; max-height:0; transition:max-height 0.28s cubic-bezier(0.4,0,0.2,1); }
    #${PANEL_ID} .jj-settings.open { max-height:220px; }
    #${PANEL_ID} .jj-settings-inner {
        padding:10px 12px 14px; border-top:1px solid var(--border-sep);
        background:var(--bg-settings); display:flex; flex-direction:column; gap:12px;
    }
    #${PANEL_ID} .jj-setting-row { display:flex; align-items:center; justify-content:space-between; }
    #${PANEL_ID} .jj-setting-label { font-size:12px; font-weight:600; color:var(--text); }
    #${PANEL_ID} .jj-setting-sub   { font-size:10px; color:var(--text-muted); margin-top:2px; }
    #${PANEL_ID} .jj-toggle {
        width:40px; height:22px; background:var(--toggle-track);
        border-radius:11px; position:relative; cursor:pointer;
        border:none; padding:0; flex-shrink:0; transition:background 0.2s;
    }
    #${PANEL_ID} .jj-toggle[data-checked="true"] { background:var(--toggle-on); }
    #${PANEL_ID} .jj-toggle .jj-toggle-knob {
        position:absolute; top:3px; left:3px; width:16px; height:16px; background:#fff;
        border-radius:50%; box-shadow:0 1px 3px rgba(0,0,0,0.2);
        transition:transform 0.2s cubic-bezier(0.4,0,0.2,1);
    }
    #${PANEL_ID} .jj-danger-btn {
        width:100%; padding:8px 12px; background:transparent; color:#ef4444;
        font-size:12px; font-weight:600; border:1px solid rgba(239,68,68,0.25);
        border-radius:10px; cursor:pointer; text-align:center;
        transition:background 0.15s, border-color 0.15s;
    }
    #${PANEL_ID} .jj-danger-btn:hover { background:rgba(239,68,68,0.07); border-color:rgba(239,68,68,0.5); }
    #${PANEL_ID} .jj-logout-visible-btn {
        width:100%; padding:8px 12px; background:transparent; color:var(--text-muted);
        font-size:12px; font-weight:500; border:1px solid var(--border-btn);
        border-radius:10px; cursor:pointer; text-align:center;
        transition:background 0.15s, color 0.15s, border-color 0.15s;
    }
    #${PANEL_ID} .jj-logout-visible-btn:hover { color:#ef4444; border-color:rgba(239,68,68,0.35); }

    #${MINI_ID} {
        position:fixed; right:20px; bottom:20px; z-index:2147483647;
        width:46px; height:46px; background:rgba(255,255,255,0.92); color:#334155;
        border-radius:50%; box-shadow:0 8px 24px rgba(15,23,42,0.18);
        border:1px solid rgba(148,163,184,0.2); cursor:pointer;
        display:none; align-items:center; justify-content:center;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:10px; font-weight:700; letter-spacing:0.05em; user-select:none;
        backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
        transition:background 0.25s, color 0.25s, border-color 0.25s;
    }

        `;
        document.head.appendChild(style);

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="jj-header">
                <div class="jj-header-left">
                    <span class="jj-title">Cezanne Exporter</span>
                    <span class="jj-role-tag" id="jj-role-tag"></span>
                </div>
                <div class="jj-header-right">
                    <button class="jj-icon-btn" id="jj-settings-btn" title="Ajustes">⚙</button>
                    <button class="jj-icon-btn" id="jj-collapse-btn" title="Minimizar">−</button>
                </div>
            </div>

            <div id="jj-toast" class="jj-toast"></div>

            <div class="jj-body">
                <div class="jj-section-label">Plantillas</div>

                <button class="jj-btn" id="jj-btn-maestro">
                    <span class="jj-btn-icon">↓</span>
                    <span>Maestro de empleados</span>
                </button>

                <button class="jj-btn" id="jj-btn-activos" style="display:none">
                    <span class="jj-btn-icon">↓</span>
                    <span>Empleados Activos</span>
                </button>

                <button class="jj-btn" id="jj-btn-revision" style="display:none">
                    <span class="jj-btn-icon">↓</span>
                    <span>Revisión Médica 2025</span>
                </button>

                <div id="jj-status-text" class="jj-status-text">Listo</div>

                <button class="jj-logout-visible-btn" id="jj-cancel-visible-btn">Cancelar</button>
            </div>

            <div class="jj-settings" id="jj-settings-panel">
                <div class="jj-settings-inner">
                    <div class="jj-section-label">Ajustes</div>
                    <div class="jj-setting-row">
                        <div>
                            <div class="jj-setting-label">Tema oscuro</div>
                            <div class="jj-setting-sub">Cambia entre claro y oscuro</div>
                        </div>
                        <button class="jj-toggle" id="jj-theme-toggle" data-checked="false">
                            <span class="jj-toggle-knob"></span>
                        </button>
                    </div>
                    <button class="jj-danger-btn" id="jj-logout-btn">🔑 Cambiar contraseña</button>
                </div>
            </div>`;

        const mini = document.createElement('div');
        mini.id = MINI_ID;
        mini.innerHTML = 'EX';

        document.body.appendChild(panel);
        document.body.appendChild(mini);

        // Aplicar tema y perfil guardados al cargar
        applyTheme(getTheme());
        const savedProfile = getStoredProfile();
        if (getStoredToken() && savedProfile && PROFILES[savedProfile]) {
            applyProfile(savedProfile);
        }

        const PANEL_W = 268, MINI_W = 46, SNAP_THRESHOLD = 80;

        // Posición guardada
        const pos = getPos();
        if (pos) {
            const { x, y } = clampPos(pos.x, pos.y, PANEL_W, 220);
            [panel, mini].forEach(el => {
                el.style.left = x + 'px'; el.style.top = y + 'px';
                el.style.right = 'auto'; el.style.bottom = 'auto';
            });
        }

        let collapsed = getCollapsed();

        // collapsePanel: mini aparece en la esquina donde estaba el botón "−"
        function collapsePanel() {
            const r = panel.getBoundingClientRect();
            mini.style.left = (r.right - MINI_W) + 'px';
            mini.style.top  = r.top + 'px';
            mini.style.right = 'auto'; mini.style.bottom = 'auto';
            panel.style.display = 'none'; mini.style.display = 'flex';
            collapsed = true; setCollapsed(true);
        }
        // expandPanel: panel se abre con la esquina superior derecha alineada con el mini
        function expandPanel() {
            const r = mini.getBoundingClientRect();
            panel.style.left = Math.max(0, r.right - PANEL_W) + 'px';
            panel.style.top  = r.top + 'px';
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

        // Ajustes
        const settingsBtn   = panel.querySelector('#jj-settings-btn');
        const settingsPanel = panel.querySelector('#jj-settings-panel');
        settingsBtn.addEventListener('click', () => {
            const isOpen = settingsPanel.classList.toggle('open');
            settingsBtn.classList.toggle('active', isOpen);
        });

        // Toggle tema
        panel.querySelector('#jj-theme-toggle').addEventListener('click', () => {
            const next = getTheme() === 'dark' ? 'light' : 'dark';
            saveTheme(next); applyTheme(next);
        });

        // Cerrar sesión (ajustes)
        panel.querySelector('#jj-logout-btn').addEventListener('click', doLogout);

        function doLogout() {
            clearToken(); clearProfile(); authVerified = false;
            setStatus('', 'Listo');
            // Ocultar todos los botones hasta que se vuelva a autenticar
            ['#jj-btn-maestro','#jj-btn-activos','#jj-btn-revision'].forEach(sel => {
                const b = panel.querySelector(sel);
                if (b) { b.style.display = 'none'; }
            });
            const roleTag = panel.querySelector('#jj-role-tag');
            if (roleTag) roleTag.textContent = '';
            settingsPanel.classList.remove('open');
            settingsBtn.classList.remove('active');
        }

        // Cancelar tarea (botón siempre visible)
        panel.querySelector('#jj-cancel-visible-btn').addEventListener('click', () => {
            if (!window.__jj_export_running) return;
            window.__jj_export_abort = true;
            setStatus('', 'Cancelando…');
        });

        // Botones de plantillas
        function handleBtnClick(flowFn) {
            return () => {
                if (window.__jj_export_running) { setStatus('running', 'Tarea en curso, espera…'); return; }
                ensureAuth((profileKey) => { applyProfile(profileKey); flowFn(); });
            };
        }
        panel.querySelector('#jj-btn-maestro') .addEventListener('click', handleBtnClick(runExportFlow));
        panel.querySelector('#jj-btn-activos') .addEventListener('click', handleBtnClick(() => setStatus('error', '⚙️ Flujo pendiente de implementar')));
        panel.querySelector('#jj-btn-revision').addEventListener('click', handleBtnClick(() => setStatus('error', '⚙️ Flujo pendiente de implementar')));

        makeDraggable(panel, panel.querySelector('.jj-header'), (r) => {
            // Si se suelta cerca del borde derecho → snap pegado al borde (totalmente visible)
            let x = r.left, y = r.top;
            if (window.innerWidth - r.right < SNAP_THRESHOLD) {
                x = window.innerWidth - PANEL_W;
            }
            panel.style.left = x + 'px';
            savePos(x, y);
        });
        makeDraggable(mini, mini);

        // Restaurar estado dock al cargar
        if (collapsed) collapsePanel();
    }

    function initWhenReady() {
        if (!document.body) { setTimeout(initWhenReady, 500); return; }
        createUI();
    }
    initWhenReady();
})();
