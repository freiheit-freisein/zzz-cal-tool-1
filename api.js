/**
 * Enka / HoYoLAB API データ取得専用モジュール (多重プロキシ＆タイムアウト強化版)
 */
const ZZZApi = {
    async fetchByUid(uid) {
        if (!uid) {
            throw new Error('[ERR_NO_UID] UIDを入力してください。');
        }

        const targetUrl = `https://enka.network/api/zzz/uid/${uid}`;
        let logHistory = [`[DEBUG] Target UID: ${uid}`];

        // 信頼性の高い複数のCORSプロキシリスト
        const proxies = [
            { name: 'Corsproxy.io', url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}` },
            { name: 'Allorigins (Raw)', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}` },
            { name: 'Thingproxy', url: `https://thingproxy.freeboard.io/fetch/${targetUrl}` }
        ];

        for (let i = 0; i < proxies.length; i++) {
            const p = proxies[i];
            logHistory.push(`[TRY ${i + 1}] Testing via ${p.name}...`);

            try {
                const res = await fetch(p.url, { signal: AbortSignal.timeout(5000) });
                logHistory.push(`[TRY ${i + 1} Status] HTTP ${res.status}`);

                if (res.ok) {
                    const contentType = res.headers.get('content-type') || '';
                    let data;
                    
                    if (contentType.includes('json')) {
                        data = await res.json();
                    } else {
                        const text = await res.text();
                        data = JSON.parse(text);
                    }

                    return this.deepParse(data, p.name, logHistory);
                }
            } catch (e) {
                logHistory.push(`[TRY ${i + 1} Error] ${e.name}: ${e.message}`);
            }
        }

        throw new Error(`【通信遮断エラー】\n${logHistory.join('\n')}\n----------------------------------------\n公開CORSプロキシがすべてダウンまたはブロックされています。WEB上の「JSON直貼り入力」機能をご利用ください。`);
    },

    parseJsonString(rawJson) {
        let logHistory = [`[DEBUG] Manual JSON Input...`];
        try {
            const data = JSON.parse(rawJson);
            return this.deepParse(data, 'JSON Direct Input', logHistory);
        } catch (e) {
            throw new Error(`[ERR_INVALID_JSON] SyntaxError: ${e.message}`);
        }
    },

    deepParse(data, sourceName, logHistory) {
        if (!data) throw new Error('[ERR_NULL_PAYLOAD] レスポンスが空です。');

        const rootKeys = Object.keys(data);
        logHistory.push(`[ROOT KEYS] [${rootKeys.join(', ')}]`);

        let charList = null;
        const possibleKeys = ['avatarInfoList', 'characters', 'avatarList', 'avatars', 'AvatarInfoList', 'Characters'];

        for (const key of possibleKeys) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                charList = data[key];
                logHistory.push(`[MATCH] Found agents in root key: "${key}"`);
                break;
            }
        }

        if (!charList) {
            const pInfo = data.PlayerInfo || data.playerInfo;
            if (pInfo && typeof pInfo === 'object') {
                for (const key of possibleKeys) {
                    if (Array.isArray(pInfo[key]) && pInfo[key].length > 0) {
                        charList = pInfo[key];
                        logHistory.push(`[MATCH] Found agents inside PlayerInfo."${key}"`);
                        break;
                    }
                }
            }
        }

        if (!charList) {
            for (const k in data) {
                if (Array.isArray(data[k]) && data[k].length > 0 && typeof data[k][0] === 'object') {
                    charList = data[k];
                    logHistory.push(`[AUTO SCAN] Found array in root["${k}"]`);
                    break;
                }
            }
        }

        if (!charList) {
            throw new Error(`【構造パースエラー】\n${logHistory.join('\n')}\n----------------------------------------\nレスポンスを受信しましたが、エージェント配列を検出できませんでした。`);
        }

        logHistory.push(`[SUCCESS] ${charList.length} 件のエージェントデータを抽出完了。`);

        return {
            success: true,
            source: sourceName,
            characters: charList,
            raw: data,
            logs: logHistory.join('\n')
        };
    }
};