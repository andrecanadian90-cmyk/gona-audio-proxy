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

        console.log(`[GrantProxy] Processing Asset #${assetId} permission for Universe #${universeId}...`);

        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        if (apiKey) headers['x-api-key'] = apiKey;

        if (process.env.ROBLOX_COOKIE) {
            let cVal = process.env.ROBLOX_COOKIE.trim();
            if (!cVal.startsWith('.ROBLOSECURITY=')) cVal = `.ROBLOSECURITY=${cVal}`;
            headers['Cookie'] = cVal;
        }

        const targetUrl = `https://apis.roblox.com/asset-permissions-api/v1/assets/${assetId}/permissions`;

        // Step 1: Initial request to fetch Roblox X-CSRF-Token
        console.log('[GrantProxy] Step 1: Fetching Roblox X-CSRF-Token from asset-permissions-api...');
        let initialRes = await fetch(targetUrl, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify({ requests: [{ action: "GrantUse", subjectType: "Universe", subjectId: Number(universeId) }] })
        });

        let csrfToken = initialRes.headers.get('x-csrf-token') || initialRes.headers.get('X-CSRF-TOKEN') || initialRes.headers.get('X-Csrf-Token');

        console.log('[GrantProxy] CSRF Token Fetched:', csrfToken ? 'YES (Valid)' : 'NO');

        if (csrfToken) {
            headers['x-csrf-token'] = csrfToken;

            // Format A: { requests: [...] }
            console.log('[GrantProxy] Step 2A: Sending Format A { requests: [...] }');
            let grantRes = await fetch(targetUrl, {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify({
                    requests: [{ action: "GrantUse", subjectType: "Universe", subjectId: Number(universeId) }]
                })
            });

            let grantData = await grantRes.json().catch(() => ({}));

            if (grantRes.ok) {
                console.log('[GrantProxy] ✅ UNIVERSE PERMISSION GRANTED VIA FORMAT A!', grantData);
                return res.status(200).json({ success: true, format: 'A', data: grantData });
            }

            // Format B: Array directly [{ action: "GrantUse", subjectType: "Universe", subjectId: Number(universeId) }]
            console.log('[GrantProxy] Step 2B: Sending Format B Array [...]');
            grantRes = await fetch(targetUrl, {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify([
                    { action: "GrantUse", subjectType: "Universe", subjectId: Number(universeId) }
                ])
            });

            grantData = await grantRes.json().catch(() => ({}));

            if (grantRes.ok) {
                console.log('[GrantProxy] ✅ UNIVERSE PERMISSION GRANTED VIA FORMAT B!', grantData);
                return res.status(200).json({ success: true, format: 'B', data: grantData });
            }

            // Format C: Single Object { action: "GrantUse", subjectType: "Universe", subjectId: Number(universeId) }
            console.log('[GrantProxy] Step 2C: Sending Format C Single Object {...}');
            grantRes = await fetch(targetUrl, {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify({ action: "GrantUse", subjectType: "Universe", subjectId: Number(universeId) })
            });

            grantData = await grantRes.json().catch(() => ({}));

            if (grantRes.ok) {
                console.log('[GrantProxy] ✅ UNIVERSE PERMISSION GRANTED VIA FORMAT C!', grantData);
                return res.status(200).json({ success: true, format: 'C', data: grantData });
            }

            return res.status(grantRes.status).json({ error: grantData.message || 'Roblox Grant Failed', details: grantData });
        } else {
            const initialData = await initialRes.json().catch(() => ({}));
            return res.status(initialRes.status).json({
                error: 'Failed to obtain x-csrf-token from Roblox API',
                status: initialRes.status,
                details: initialData
            });
        }

    } catch (err) {
        console.error('[GrantProxy] Internal Exception:', err);
        return res.status(500).json({ error: err.message });
    }
};
