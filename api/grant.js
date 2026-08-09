// G0NA Asset Permission Grant Proxy for Vercel
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

        if (!apiKey || !assetId || !universeId) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        console.log(`[GrantProxy] Granting Universe #${universeId} use for Asset #${assetId}...`);

        // Try Roblox Open Cloud Asset Permissions API directly on apis.roblox.com
        const payload = {
            requests: [
                {
                    action: "GrantUse",
                    subjectType: "Universe",
                    subjectId: String(universeId)
                }
            ]
        };

        // 1. Try asset-permissions/v1 PATCH
        let rRes = await fetch(`https://apis.roblox.com/asset-permissions/v1/assets/${assetId}/permissions`, {
            method: 'PATCH',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        let data = await rRes.json().catch(() => ({}));

        if (rRes.ok) {
            console.log('[GrantProxy] Grant Success via PATCH asset-permissions!');
            return res.status(200).json({ success: true, message: 'Permission Granted!' });
        }

        // 2. Try assets/v1 POST
        rRes = await fetch(`https://apis.roblox.com/assets/v1/assets/${assetId}/permissions`, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: "GrantUse",
                subjectType: "Universe",
                subjectId: String(universeId)
            })
        });

        data = await rRes.json().catch(() => ({}));

        if (rRes.ok) {
            console.log('[GrantProxy] Grant Success via POST assets/v1!');
            return res.status(200).json({ success: true, message: 'Permission Granted!' });
        }

        console.error('[GrantProxy] Roblox Grant Error:', data);
        return res.status(rRes.status).json({ error: data.message || 'Roblox Grant Failed', details: data });

    } catch (err) {
        console.error('[GrantProxy] Internal Exception:', err);
        return res.status(500).json({ error: err.message });
    }
};
