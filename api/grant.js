// G0NA Asset Permission Grant Proxy for Vercel Serverless
const fetch = require('node-fetch');

async function getRobloxCsrfToken(headers) {
    try {
        const res = await fetch('https://apis.roblox.com/asset-permissions-api/v1/assets/1/permissions', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ requests: [] })
        });
        const token = res.headers.get('x-csrf-token') || res.headers.get('X-CSRF-TOKEN') || res.headers.get('x-csrf-token');
        if (token) return token;
    } catch (e) {}

    try {
        const res = await fetch('https://auth.roblox.com/v2/login', {
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

        // Obtain CSRF Token
        const csrfToken = await getRobloxCsrfToken(baseHeaders);
        console.log('[GrantProxy] Fetched CSRF Token:', csrfToken ? 'SUCCESS' : 'NONE');

        if (csrfToken) {
            baseHeaders['x-csrf-token'] = csrfToken;
        }

        const targetUrl = `https://apis.roblox.com/asset-permissions-api/v1/assets/${assetId}/permissions`;
        const payloadStr = JSON.stringify({
            requests: [
                {
                    subjectType: "Universe",
                    subjectId: Number(universeId),
                    action: "GrantUse"
                }
            ]
        });

        // Attempt 1: PATCH with requests array
        console.log('[GrantProxy] Trying Attempt 1: PATCH requests array...');
        let grantRes = await fetch(targetUrl, {
            method: 'PATCH',
            headers: baseHeaders,
            body: payloadStr
        });

        let grantData = await grantRes.json().catch(() => ({}));
        console.log('[GrantProxy] Attempt 1 Status:', grantRes.status, grantData);

        if (grantRes.ok) {
            return res.status(200).json({ success: true, method: 'PATCH requests', data: grantData });
        }

        // Attempt 2: POST with requests array
        console.log('[GrantProxy] Trying Attempt 2: POST requests array...');
        grantRes = await fetch(targetUrl, {
            method: 'POST',
            headers: baseHeaders,
            body: payloadStr
        });

        grantData = await grantRes.json().catch(() => ({}));
        console.log('[GrantProxy] Attempt 2 Status:', grantRes.status, grantData);

        if (grantRes.ok) {
            return res.status(200).json({ success: true, method: 'POST requests', data: grantData });
        }

        // Attempt 3: POST with single object
        console.log('[GrantProxy] Trying Attempt 3: POST single object...');
        grantRes = await fetch(targetUrl, {
            method: 'POST',
            headers: baseHeaders,
            body: JSON.stringify({
                subjectType: "Universe",
                subjectId: Number(universeId),
                action: "GrantUse"
            })
        });

        grantData = await grantRes.json().catch(() => ({}));
        console.log('[GrantProxy] Attempt 3 Status:', grantRes.status, grantData);

        if (grantRes.ok) {
            return res.status(200).json({ success: true, method: 'POST single', data: grantData });
        }

        return res.status(grantRes.status).json({
            error: 'Roblox Grant Failed',
            hasCsrfToken: Boolean(csrfToken),
            status: grantRes.status,
            details: grantData
        });

    } catch (err) {
        console.error('[GrantProxy] Internal Exception:', err);
        return res.status(500).json({ error: err.message });
    }
};
