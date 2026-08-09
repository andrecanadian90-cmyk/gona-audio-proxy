// G0NA Asset Permission Grant Proxy for Vercel Serverless
const fetch = require('node-fetch');

// Helper to fetch valid X-CSRF-Token using Cookie only
async function fetchCsrfToken(cookieHeader) {
    try {
        const res = await fetch('https://auth.roblox.com/v2/login', {
            method: 'POST',
            headers: {
                'Cookie': cookieHeader,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            body: '{}'
        });
        return res.headers.get('x-csrf-token') || res.headers.get('X-CSRF-TOKEN');
    } catch (e) {
        return null;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const apiKey = req.headers['x-api-key'];
        const { assetId, universeId } = req.body;

        if (!assetId || !universeId) {
            return res.status(400).json({ error: 'Missing parameters: assetId, universeId' });
        }

        const numAssetId = Number(assetId);
        const numUniverseId = Number(universeId);
        console.log(`[GrantProxy] Processing Grant for Asset #${numAssetId} to Universe #${numUniverseId}...`);

        const attempts = [];

        // -------------------------------------------------------------
        // APPROACH 1: Pure Open Cloud API Key (NO Cookie, NO CSRF)
        // -------------------------------------------------------------
        if (apiKey) {
            console.log('[GrantProxy] Trying Approach 1: Pure Open Cloud API Key...');
            const openCloudHeaders = {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'User-Agent': 'Roblox/WinInet'
            };

            const openCloudEndpoints = [
                {
                    name: 'OpenCloud v1 PATCH (apis.roblox.com/assets/v1/assets/{id}/permissions)',
                    url: `https://apis.roblox.com/assets/v1/assets/${numAssetId}/permissions`,
                    method: 'PATCH',
                    body: JSON.stringify({
                        requests: [{ action: "GrantUse", subjectType: "Universe", subjectId: String(numUniverseId) }]
                    })
                },
                {
                    name: 'OpenCloud v1 POST (apis.roblox.com/assets/v1/assets/{id}/permissions)',
                    url: `https://apis.roblox.com/assets/v1/assets/${numAssetId}/permissions`,
                    method: 'POST',
                    body: JSON.stringify({
                        action: "GrantUse", subjectType: "Universe", subjectId: String(numUniverseId)
                    })
                },
                {
                    name: 'OpenCloud asset-permissions PATCH (apis.roblox.com/asset-permissions/v1/assets/{id}/permissions)',
                    url: `https://apis.roblox.com/asset-permissions/v1/assets/${numAssetId}/permissions`,
                    method: 'PATCH',
                    body: JSON.stringify({
                        requests: [{ action: "GrantUse", subjectType: "Universe", subjectId: String(numUniverseId) }]
                    })
                }
            ];

            for (const ep of openCloudEndpoints) {
                try {
                    const r = await fetch(ep.url, { method: ep.method, headers: openCloudHeaders, body: ep.body });
                    const d = await r.json().catch(() => ({}));
                    attempts.push({ mode: 'OpenCloudKey', ep: ep.name, status: r.status, data: d });
                    if (r.ok) {
                        console.log(`[GrantProxy] ✅ SUCCESS via OpenCloud (${ep.name})!`);
                        return res.status(200).json({ success: true, mode: 'OpenCloudKey', ep: ep.name, data: d });
                    }
                } catch (e) { attempts.push({ mode: 'OpenCloudKey', ep: ep.name, error: e.message }); }
            }
        }

        // -------------------------------------------------------------
        // APPROACH 2: Pure Web Cookie Auth (NO x-api-key, WITH CSRF)
        // -------------------------------------------------------------
        if (process.env.ROBLOX_COOKIE) {
            console.log('[GrantProxy] Trying Approach 2: Pure Cookie Auth...');
            let cookieVal = process.env.ROBLOX_COOKIE.trim();
            if (!cookieVal.startsWith('.ROBLOSECURITY=')) {
                cookieVal = `.ROBLOSECURITY=${cookieVal}`;
            }

            const csrfToken = await fetchCsrfToken(cookieVal);
            console.log('[GrantProxy] Pure Cookie CSRF Token:', csrfToken ? 'OBTAINED' : 'FAILED');

            const cookieHeaders = {
                'Cookie': cookieVal,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            };

            if (csrfToken) {
                cookieHeaders['x-csrf-token'] = csrfToken;
            }

            const webEndpoints = [
                {
                    name: 'Web asset-permissions-api PATCH (apis.roblox.com/asset-permissions-api/v1/assets/{id}/permissions)',
                    url: `https://apis.roblox.com/asset-permissions-api/v1/assets/${numAssetId}/permissions`,
                    method: 'PATCH',
                    body: JSON.stringify({
                        requests: [{ action: "GrantUse", subjectType: "Universe", subjectId: numUniverseId }]
                    })
                },
                {
                    name: 'Web Batch asset-permissions-api POST (apis.roblox.com/asset-permissions-api/v1/assets/permissions)',
                    url: `https://apis.roblox.com/asset-permissions-api/v1/assets/permissions`,
                    method: 'POST',
                    body: JSON.stringify({
                        requests: [{ assetId: numAssetId, action: "GrantUse", subjectType: "Universe", subjectId: numUniverseId }]
                    })
                },
                {
                    name: 'Web Batch asset-permissions-api PATCH (apis.roblox.com/asset-permissions-api/v1/assets/permissions)',
                    url: `https://apis.roblox.com/asset-permissions-api/v1/assets/permissions`,
                    method: 'PATCH',
                    body: JSON.stringify({
                        requests: [{ assetId: numAssetId, action: "GrantUse", subjectType: "Universe", subjectId: numUniverseId }]
                    })
                }
            ];

            for (const ep of webEndpoints) {
                try {
                    const r = await fetch(ep.url, { method: ep.method, headers: cookieHeaders, body: ep.body });
                    const d = await r.json().catch(() => ({}));
                    attempts.push({ mode: 'CookieWeb', ep: ep.name, status: r.status, data: d });
                    if (r.ok) {
                        console.log(`[GrantProxy] ✅ SUCCESS via CookieWeb (${ep.name})!`);
                        return res.status(200).json({ success: true, mode: 'CookieWeb', ep: ep.name, data: d });
                    }
                } catch (e) { attempts.push({ mode: 'CookieWeb', ep: ep.name, error: e.message }); }
            }
        }

        console.error('[GrantProxy] All Approaches Failed:', attempts);
        return res.status(400).json({ error: 'Roblox Grant Failed', attempts });

    } catch (err) {
        console.error('[GrantProxy] Internal Exception:', err);
        return res.status(500).json({ error: err.message });
    }
};
