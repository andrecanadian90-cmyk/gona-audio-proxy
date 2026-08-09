// G0NA Asset Permission Grant Proxy for Vercel Serverless
const fetch = require('node-fetch');

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

        console.log(`[GrantProxy] Granting Universe #${universeId} use for Asset #${assetId}...`);

        const attempts = [];

        // Build headers for Cookie Auth and API Key Auth
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        if (apiKey) {
            headers['x-api-key'] = apiKey;
        }

        if (process.env.ROBLOX_COOKIE) {
            let cookieVal = process.env.ROBLOX_COOKIE.trim();
            if (!cookieVal.startsWith('.ROBLOSECURITY=')) {
                cookieVal = `.ROBLOSECURITY=${cookieVal}`;
            }
            headers['Cookie'] = cookieVal;
        }

        const grantPayload = {
            requests: [
                {
                    action: "GrantUse",
                    subjectType: "Universe",
                    subjectId: Number(universeId)
                }
            ]
        };

        // Method 1: assetpermissions.roblox.com POST (Official Dashboard Web Permission API)
        try {
            const r1 = await fetch(`https://assetpermissions.roblox.com/v1/assets/${assetId}/permissions`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(grantPayload)
            });
            const d1 = await r1.json().catch(() => ({}));
            attempts.push({ method: 'assetpermissions POST', status: r1.status, data: d1 });
            if (r1.ok) {
                console.log('[GrantProxy] Success via assetpermissions POST!');
                return res.status(200).json({ success: true, method: 'assetpermissions POST', data: d1 });
            }
        } catch (e) { attempts.push({ method: 'assetpermissions POST', error: e.message }); }

        // Method 2: develop.roblox.com POST (Legacy Developer Permission API)
        try {
            const r2 = await fetch(`https://develop.roblox.com/v1/assets/${assetId}/permissions`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(grantPayload)
            });
            const d2 = await r2.json().catch(() => ({}));
            attempts.push({ method: 'develop POST', status: r2.status, data: d2 });
            if (r2.ok) {
                console.log('[GrantProxy] Success via develop POST!');
                return res.status(200).json({ success: true, method: 'develop POST', data: d2 });
            }
        } catch (e) { attempts.push({ method: 'develop POST', error: e.message }); }

        // Method 3: apis.roblox.com/asset-permissions/v1/assets/{id}/permissions PATCH
        try {
            const r3 = await fetch(`https://apis.roblox.com/asset-permissions/v1/assets/${assetId}/permissions`, {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify(grantPayload)
            });
            const d3 = await r3.json().catch(() => ({}));
            attempts.push({ method: 'apis PATCH', status: r3.status, data: d3 });
            if (r3.ok) {
                console.log('[GrantProxy] Success via apis PATCH!');
                return res.status(200).json({ success: true, method: 'apis PATCH', data: d3 });
            }
        } catch (e) { attempts.push({ method: 'apis PATCH', error: e.message }); }

        console.error('[GrantProxy] All Grant Endpoints Failed:', attempts);
        return res.status(400).json({ error: 'Roblox Grant Failed across all endpoints', attempts });

    } catch (err) {
        console.error('[GrantProxy] Internal Exception:', err);
        return res.status(500).json({ error: err.message });
    }
};
