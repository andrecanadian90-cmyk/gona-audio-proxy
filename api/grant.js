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

        console.log(`[GrantProxy] Testing all Roblox Permission APIs for Asset #${assetId} & Universe #${universeId}...`);

        const attempts = [];

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
            requests: [{ action: "GrantUse", subjectType: "Universe", subjectId: Number(universeId) }]
        });

        const payloadSingle = JSON.stringify({
            action: "GrantUse", subjectType: "Universe", subjectId: Number(universeId)
        });

        const testEndpoints = [
            { name: "asset-permissions-api PATCH", url: `https://apis.roblox.com/asset-permissions-api/v1/assets/${assetId}/permissions`, method: 'PATCH', body: payloadRequests },
            { name: "asset-permissions-api POST", url: `https://apis.roblox.com/asset-permissions-api/v1/assets/${assetId}/permissions`, method: 'POST', body: payloadSingle },
            { name: "itemconfiguration POST", url: `https://itemconfiguration.roblox.com/v1/assets/${assetId}/permissions`, method: 'POST', body: payloadSingle },
            { name: "publish POST", url: `https://publish.roblox.com/v1/assets/${assetId}/permissions`, method: 'POST', body: payloadSingle },
            { name: "apis assets/v1 POST", url: `https://apis.roblox.com/assets/v1/assets/${assetId}/permissions`, method: 'POST', body: payloadSingle },
            { name: "universe-permissions POST", url: `https://apis.roblox.com/universe-permissions/v1/experiences/${universeId}/assets/${assetId}`, method: 'POST', body: payloadSingle }
        ];

        for (const ep of testEndpoints) {
            try {
                const r = await fetch(ep.url, {
                    method: ep.method,
                    headers: headers,
                    body: ep.body
                });
                const d = await r.json().catch(() => ({}));
                attempts.push({ ep: ep.name, status: r.status, data: d });
                if (r.ok) {
                    console.log(`[GrantProxy] SUCCESS via ${ep.name}!`, d);
                    return res.status(200).json({ success: true, endpoint: ep.name, data: d });
                }
            } catch (err) {
                attempts.push({ ep: ep.name, error: err.message });
            }
        }

        console.error('[GrantProxy] All Permission Endpoints Failed:', attempts);
        return res.status(400).json({ error: 'All Permission Endpoints Failed', attempts });

    } catch (err) {
        console.error('[GrantProxy] Internal Exception:', err);
        return res.status(500).json({ error: err.message });
    }
};
