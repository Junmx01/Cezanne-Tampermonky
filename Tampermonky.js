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