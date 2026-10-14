/**
 * Enka / HoYoLAB API データ取得専用モジュール (プロキシ拡張＆パース自動深層検索)
 */
const ZZZApi = {
    async fetchByUid(uid) {
        if (!uid) {
            throw new Error('[ERR_NO_UID] UIDを入力してください。');
        }

        const targetUrl = `https://enka.network/api/zzz/uid/${uid}`;
        let logHistory = [`[DEBUG] Target UID: ${uid}`];

        // 利用するプロキシサービスのリスト
        const proxies = [
            {
                name: 'Allorigins (Raw)',
                fetch: async () => {
                    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, { signal: AbortSignal.timeout(8000) });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return await res.json();
                }
            },
            {
                name: 'Allorigins (JSON Wrapper)',
                fetch: async () => {
                    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, { signal: AbortSignal.timeout(8000) });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const wrapper = await res.json();
                    return typeof wrapper.contents === 'string' ? JSON.parse(wrapper.contents) : wrapper.contents;
                }
            },
            {
                name: 'Thingproxy',
                fetch: async () => {
                    const res = await fetch(`https://thingproxy.freeboard.io/fetch/${targetUrl}`, { signal: AbortSignal.timeout(8000) });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return await res.json();
                }
            },
            {
                name: 'Corsproxy.io',
                fetch: async () => {
                    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, { signal: AbortSignal.timeout(5000) });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return await res.json();
                }
            }
        ];

        for (let i = 0; i < proxies.length; i++) {
            const p = proxies[i];
            logHistory.push(`[TRY ${i + 1}] Testing via ${p.name}...`);

            try {
                const data = await p.fetch();
                return this.deepParse(data, p.name, logHistory);
            } catch (e) {
                logHistory.push(`[TRY ${i + 1} Failed] ${e.name}: ${e.message}`);
            }
        }

        throw new Error(`【通信・解析失敗レポート】\n${logHistory.join('\n')}\n----------------------------------------\n公開プロキシ経由での通信が遮断されています。「JSON直貼り入力」をお使いいただくか、時間をおいて再試行してください。`);
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
        const possibleKeys = ['avatarInfoList', 'characters', 'avatarList', 'avatars', 'AvatarInfoList', 'Characters', 'AvatarList', 'Avatars'];

        // 1. 直下キーの探索
        for (const key of possibleKeys) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                charList = data[key];
                logHistory.push(`[MATCH] Found agent array in root."${key}"`);
                break;
            }
        }

        // 2. PlayerInfo 内部の探索
        if (!charList) {
            const pInfo = data.PlayerInfo || data.playerInfo;
            if (pInfo && typeof pInfo === 'object') {
                logHistory.push(`[SEARCH] Searching inside PlayerInfo...`);
                for (const key of possibleKeys) {
                    if (Array.isArray(pInfo[key]) && pInfo[key].length > 0) {
                        charList = pInfo[key];
                        logHistory.push(`[MATCH] Found agent array inside PlayerInfo."${key}"`);
                        break;
                    }
                }
            }
        }

        // 3. 深層全自動探索（フォールバック）
        if (!charList) {
            logHistory.push(`[SEARCH] Deep scan for array objects...`);
            for (const k in data) {
                if (Array.isArray(data[k]) && data[k].length > 0 && typeof data[k][0] === 'object') {
                    charList = data[k];
                    logHistory.push(`[AUTO SCAN] Found array in root["${k}"]`);
                    break;
                }
            }
        }

        if (!charList) {
            throw new Error(`【構造パースエラー】\n${logHistory.join('\n')}\n----------------------------------------\nレスポンスは取得できましたが、エージェント配列(characters)が見つかりませんでした。`);
        }

        logHistory.push(`[SUCCESS] Detected ${charList.length} character(s).`);

        return {
            success: true,
            source: sourceName,
            characters: charList,
            raw: data,
            logs: logHistory.join('\n')
        };
    }
};