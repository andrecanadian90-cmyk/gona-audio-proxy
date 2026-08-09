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

        if (!apiKey || !assetId || !universeId) {
            return res.status(400).json({ error: 'Missing parameters: apiKey, assetId, universeId' });
        }

        console.log(`[GrantProxy] Granting Universe #${universeId} use for Asset #${assetId}...`);

        const attempts = [];

        // Variation 1: asset-permissions/v1 PATCH (requests array)
        try {
            const r1 = await fetch(`https://apis.roblox.com/asset-permissions/v1/assets/${assetId}/permissions`, {
                method: 'PATCH',
                headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{ action: "GrantUse", subjectType: "Universe", subjectId: String(universeId) }]
                })
            });
            const d1 = await r1.json().catch(() => ({}));
            attempts.push({ v: 1, status: r1.status, data: d1 });
            if (r1.ok) return res.status(200).json({ success: true, method: 1, data: d1 });
        } catch (e) { attempts.push({ v: 1, error: e.message }); }

        // Variation 2: asset-permissions/v1 POST (requests array)
        try {
            const r2 = await fetch(`https://apis.roblox.com/asset-permissions/v1/assets/${assetId}/permissions`, {
                method: 'POST',
                headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{ action: "GrantUse", subjectType: "Universe", subjectId: String(universeId) }]
                })
            });
            const d2 = await r2.json().catch(() => ({}));
            attempts.push({ v: 2, status: r2.status, data: d2 });
            if (r2.ok) return res.status(200).json({ success: true, method: 2, data: d2 });
        } catch (e) { attempts.push({ v: 2, error: e.message }); }

        // Variation 3: asset-permissions/v1 POST (single object)
        try {
            const r3 = await fetch(`https://apis.roblox.com/asset-permissions/v1/assets/${assetId}/permissions`, {
                method: 'POST',
                headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: "GrantUse", subjectType: "Universe", subjectId: Number(universeId) })
            });
            const d3 = await r3.json().catch(() => ({}));
            attempts.push({ v: 3, status: r3.status, data: d3 });
            if (r3.ok) return res.status(200).json({ success: true, method: 3, data: d3 });
        } catch (e) { attempts.push({ v: 3, error: e.message }); }

        // Variation 4: assets/v1 POST permissions
        try {
            const r4 = await fetch(`https://apis.roblox.com/assets/v1/assets/${assetId}/permissions`, {
                method: 'POST',
                headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: "GrantUse", subjectType: "Universe", subjectId: String(universeId) })
            });
            const d4 = await r4.json().catch(() => ({}));
            attempts.push({ v: 4, status: r4.status, data: d4 });
            if (r4.ok) return res.status(200).json({ success: true, method: 4, data: d4 });
        } catch (e) { attempts.push({ v: 4, error: e.message }); }

        // Variation 5: open cloud v2 asset permissions endpoint
        try {
            const r5 = await fetch(`https://apis.roblox.com/open-cloud/v2/assets/${assetId}/permissions`, {
                method: 'PATCH',
                headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: "GrantUse", subjectType: "Universe", subjectId: String(universeId) })
            });
            const d5 = await r5.json().catch(() => ({}));
            attempts.push({ v: 5, status: r5.status, data: d5 });
            if (r5.ok) return res.status(200).json({ success: true, method: 5, data: d5 });
        } catch (e) { attempts.push({ v: 5, error: e.message }); }

        console.error('[GrantProxy] All Grant Variations Failed:', attempts);
        return res.status(400).json({ error: 'Roblox Grant Failed across all variations', attempts });

    } catch (err) {
        console.error('[GrantProxy] Internal Exception:', err);
        return res.status(500).json({ error: err.message });
    }
};
