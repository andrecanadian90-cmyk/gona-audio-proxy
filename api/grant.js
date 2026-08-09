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

        const payloadRequests = JSON.stringify({
            requests: [
                {
                    action: "GrantUse",
                    subjectType: "Universe",
                    subjectId: Number(universeId)
                }
            ]
        });

        const targetUrl = `https://apis.roblox.com/asset-permissions-api/v1/assets/${assetId}/permissions`;

        // Step 1: Initial request to fetch Roblox X-CSRF-Token
        console.log('[GrantProxy] Step 1: Fetching Roblox X-CSRF-Token from asset-permissions-api...');
        let initialRes = await fetch(targetUrl, {
            method: 'PATCH',
            headers: headers,
            body: payloadRequests
        });

        let csrfToken = initialRes.headers.get('x-csrf-token');

        if (!csrfToken && initialRes.status === 403) {
            // Also check casing variations if header getter didn't find it
            csrfToken = initialRes.headers.get('X-CSRF-TOKEN') || initialRes.headers.get('X-Csrf-Token');
        }

        console.log('[GrantProxy] CSRF Token Fetched:', csrfToken ? 'YES (Valid)' : 'NO');

        if (csrfToken) {
            headers['x-csrf-token'] = csrfToken;

            // Step 2: Re-send PATCH request with valid x-csrf-token
            console.log('[GrantProxy] Step 2: Re-sending PATCH request with valid x-csrf-token...');
            const grantRes = await fetch(targetUrl, {
                method: 'PATCH',
                headers: headers,
                body: payloadRequests
            });

            const grantData = await grantRes.json().catch(() => ({}));

            console.log('[GrantProxy] Grant Response Status:', grantRes.status, grantData);

            if (grantRes.ok) {
                console.log('[GrantProxy] ✅ UNIVERSE PERMISSION GRANTED SUCCESSFULLY!');
                return res.status(200).json({ success: true, message: 'Universe Permission Granted Successfully!', data: grantData });
            } else {
                return res.status(grantRes.status).json({ error: grantData.message || 'Roblox Grant Failed', details: grantData });
            }
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
