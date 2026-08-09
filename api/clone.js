// G0NA Audio Auto-Clone Proxy for Vercel Serverless
const fetch = require('node-fetch');
const FormData = require('form-data');

module.exports = async (req, res) => {
    // Enable CORS for Roblox Engine
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const apiKey = req.headers['x-api-key'];
        const { assetId, groupId } = req.body;

        if (!apiKey || !assetId || !groupId) {
            return res.status(400).json({ error: 'Missing parameters: apiKey, assetId, groupId' });
        }

        console.log(`[Proxy] Processing Auto-Clone for Asset #${assetId} to Group #${groupId}...`);

        // 1. Download stream audio from Roblox Asset Delivery CDN (using Cookie Auth if provided)
        const cdnHeaders = {};
        if (process.env.ROBLOX_COOKIE) {
            cdnHeaders['Cookie'] = `.ROBLOSECURITY=${process.env.ROBLOX_COOKIE}`;
        }

        const cdnRes = await fetch(`https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`, {
            headers: cdnHeaders
        });

        if (!cdnRes.ok) {
            return res.status(400).json({ error: `Failed to download audio from Roblox CDN (Status ${cdnRes.status})` });
        }

        const audioBuffer = await cdnRes.buffer();

        // 2. Format multipart/form-data payload for Roblox Open Cloud API
        const form = new FormData();
        form.append('request', JSON.stringify({
            assetType: 'Audio',
            displayName: `G0NA_AutoClone_${assetId}`,
            description: 'Auto Cloned for G0NA DJ Stage',
            creationContext: {
                creator: {
                    groupId: String(groupId)
                }
            }
        }));

        form.append('fileContent', audioBuffer, {
            filename: `audio_${assetId}.mp3`,
            contentType: 'audio/mpeg'
        });

        // 3. POST multipart/form-data to Roblox Open Cloud Assets API
        const robloxRes = await fetch('https://apis.roblox.com/assets/v1/assets', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                ...form.getHeaders()
            },
            body: form
        });

        const data = await robloxRes.json();

        if (!robloxRes.ok) {
            console.error('[Proxy] Roblox API Upload Error:', data);
            return res.status(robloxRes.status).json({ error: data.message || 'Roblox Upload Error', details: data });
        }

        console.log(`[Proxy] Auto-Clone Success! New Asset ID: #${data.assetId}`);

        return res.status(200).json({
            success: true,
            assetId: Number(data.assetId),
            message: 'Auto-Cloned successfully!'
        });

    } catch (err) {
        console.error('[Proxy] Internal Exception:', err);
        return res.status(500).json({ error: err.message });
    }
};
