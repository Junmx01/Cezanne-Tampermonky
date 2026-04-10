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
// @updateURL    https://raw.githubusercontent.com/Junmx01/Cezanne-Tampermonky/main/cezanne-export.user.js
// @downloadURL  https://raw.githubusercontent.com/Junmx01/Cezanne-Tampermonky/main/cezanne-export.user.js
// ==/UserScript==

(function () {
    'use strict';

    const AUTH_URL = 'https://crimson-breeze-86fb.jy734933371.workers.dev';

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

    // 下面接你的原代码
})();
