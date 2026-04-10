// ==UserScript==
// @name         Cezanne - Exportar Maestro de empleados
// @namespace    http://tampermonkey.net/
// @version      0.9
// @description  Exportador con autorización por código
// @match        *://*/CezanneHR/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      crimson-breeze-86fb.jy734933371.workers.dev
// @updateURL    https://raw.githubusercontent.com/你的用户名/你的仓库名/main/cezanne-export.user.js
// @downloadURL  https://raw.githubusercontent.com/你的用户名/你的仓库名/main/cezanne-export.user.js
// ==/UserScript==

(function (GM_addStyle, GM_setValue, GM_getValue, GM_xmlhttpRequest) {
    'use strict';

    const AUTH_URL          = 'https://crimson-breeze-86fb.jy734933371.workers.dev';
    const PANEL_ID          = 'jj-export-panel';
    const MINI_ID           = 'jj-export-mini';
    const STORAGE_POS       = 'jj_export_panel_pos';
    const STORAGE_COLLAPSED = 'jj_export_panel_collapsed';
    const INFORME_HREF      = '/CezanneHR/-/IQS/node/cf2ce6e3-6382-444c-800d-ea1502e71db5';

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

    // 下面把你原来的代码完整接上
})();
