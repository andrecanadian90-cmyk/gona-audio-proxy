// G0NA Asset Permission Grant Proxy for Vercel Serverless
const fetch = require('node-fetch');

async function getRobloxCsrfToken(headers) {
    try {
        const res = await fetch('https://auth.roblox.com/v2/login', {
            method: 'POST',
            headers: headers,
            body: '{}'
        });
        const token = res.headers.get('x-csrf-token') || res.headers.get('X-CSRF-TOKEN');
        if (token) return token;
    } catch (e) {}

    try {
        const res = await fetch('https://apis.roblox.com/asset-permissions-api/v1/assets/permissions', {
            method: 'POST',
            headers: headers,
            body: '{}'
        });
        const token = res.headers.get('x-csrf-token') || res.headers.get('X-CSRF-TOKEN');
        if (token) return token;
    } catch (e) {}

    return null;
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

        console.log(`[GrantProxy] Granting Asset #${assetId} use to Universe #${universeId}...`);

        const baseHeaders = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        if (apiKey) baseHeaders['x-api-key'] = apiKey;

        if (process.env.ROBLOX_COOKIE) {
            let cVal = process.env.ROBLOX_COOKIE.trim();
            if (!cVal.startsWith('.ROBLOSECURITY=')) cVal = `.ROBLOSECURITY=${cVal}`;
            baseHeaders['Cookie'] = cVal;
        }

        const csrfToken = await getRobloxCsrfToken(baseHeaders);
        if (csrfToken) {
            baseHeaders['x-csrf-token'] = csrfToken;
        }

        const numAssetId = Number(assetId);
        const numUniverseId = Number(universeId);
        const attempts = [];

        // Endpoint 1: Batch /v1/assets/permissions (POST)
        try {
            const ep1 = 'https://apis.roblox.com/asset-permissions-api/v1/assets/permissions';
            const r1 = await fetch(ep1, {
                method: 'POST',
                headers: baseHeaders,
                body: JSON.stringify({
                    requests: [{ assetId: numAssetId, action: "GrantUse", subjectType: "Universe", subjectId: numUniverseId }]
                })
            });
            const d1 = await r1.json().catch(() => ({}));
            attempts.push({ ep: 'Batch POST /v1/assets/permissions', status: r1.status, data: d1 });
            if (r1.ok) return res.status(200).json({ success: true, ep: 'Batch POST', data: d1 });
        } catch (e) { attempts.push({ ep: 'Batch POST', error: e.message }); }

        // Endpoint 2: Batch /v1/assets/permissions (PATCH)
        try {
            const ep2 = 'https://apis.roblox.com/asset-permissions-api/v1/assets/permissions';
            const r2 = await fetch(ep2, {
                method: 'PATCH',
                headers: baseHeaders,
                body: JSON.stringify({
                    requests: [{ assetId: numAssetId, action: "GrantUse", subjectType: "Universe", subjectId: numUniverseId }]
                })
            });
            const d2 = await r2.json().catch(() => ({}));
            attempts.push({ ep: 'Batch PATCH /v1/assets/permissions', status: r2.status, data: d2 });
            if (r2.ok) return res.status(200).json({ success: true, ep: 'Batch PATCH', data: d2 });
        } catch (e) { attempts.push({ ep: 'Batch PATCH', error: e.message }); }

        // Endpoint 3: Direct /v1/assets/{id}/permissions (POST)
        try {
            const ep3 = `https://apis.roblox.com/asset-permissions-api/v1/assets/${numAssetId}/permissions`;
            const r3 = await fetch(ep3, {
                method: 'POST',
                headers: baseHeaders,
                body: JSON.stringify({
                    requests: [{ action: "GrantUse", subjectType: "Universe", subjectId: numUniverseId }]
                })
            });
            const d3 = await r3.json().catch(() => ({}));
            attempts.push({ ep: 'Direct POST /v1/assets/{id}/permissions', status: r3.status, data: d3 });
            if (r3.ok) return res.status(200).json({ success: true, ep: 'Direct POST', data: d3 });
        } catch (e) { attempts.push({ ep: 'Direct POST', error: e.message }); }

        // Endpoint 4: Direct /v1/assets/{id}/permissions (PATCH)
        try {
            const ep4 = `https://apis.roblox.com/asset-permissions-api/v1/assets/${numAssetId}/permissions`;
            const r4 = await fetch(ep4, {
                method: 'PATCH',
                headers: baseHeaders,
                body: JSON.stringify({
                    requests: [{ action: "GrantUse", subjectType: "Universe", subjectId: numUniverseId }]
                })
            });
            const d4 = await r4.json().catch(() => ({}));
            attempts.push({ ep: 'Direct PATCH /v1/assets/{id}/permissions', status: r4.status, data: d4 });
            if (r4.ok) return res.status(200).json({ success: true, ep: 'Direct PATCH', data: d4 });
        } catch (e) { attempts.push({ ep: 'Direct PATCH', error: e.message }); }

        console.error('[GrantProxy] All Permission Endpoints Failed:', attempts);
        return res.status(400).json({ error: 'Roblox Grant Failed', hasCsrfToken: Boolean(csrfToken), attempts });

    } catch (err) {
        console.error('[GrantProxy] Internal Exception:', err);
        return res.status(500).json({ error: err.message });
    }
};
