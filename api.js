/**
 * Enka / HoYoLAB API データ取得専用モジュール (Enka ZZZ 構造完全準拠版)
 */
const ZZZApi = {
    async fetchByUid(uid) {
        if (!uid) {
            throw new Error('[ERR_NO_UID] UIDを入力してください。');
        }

        const targetUrl = `https://enka.network/api/zzz/uid/${uid}`;
        const proxy1 = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        const proxy2 = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

        let logHistory = [`[DEBUG] Target UID: ${uid}`];

        // --- Proxy 1 (corsproxy.io) 試行 ---
        try {
            logHistory.push(`[TRY 1] Primary Proxy (corsproxy.io)...`);
            const res1 = await fetch(proxy1, { signal: AbortSignal.timeout(4000) });
            logHistory.push(`[TRY 1 Status] HTTP ${res1.status}`);

            if (res1.ok) {
                const data = await res1.json();
                return this.deepParse(data, 'Primary Proxy (corsproxy.io)', logHistory);
            }
        } catch (e) {
            logHistory.push(`[TRY 1 Error] ${e.message}`);
        }

        // --- Proxy 2 (allorigins.win) 試行 ---
        try {
            logHistory.push(`[TRY 2] Backup Proxy (allorigins.win)...`);
            const res2 = await fetch(proxy2, { signal: AbortSignal.timeout(4000) });
            logHistory.push(`[TRY 2 Status] HTTP ${res2.status}`);

            if (res2.ok) {
                const wrapper = await res2.json();
                const data = typeof wrapper.contents === 'string' ? JSON.parse(wrapper.contents) : wrapper.contents;
                return this.deepParse(data, 'Backup Proxy (allorigins.win)', logHistory);
            }
        } catch (e) {
            logHistory.push(`[TRY 2 Error] ${e.message}`);
        }

        throw new Error(`【通信失敗レポート】\n${logHistory.join('\n')}`);
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

    // Enka ZZZの深層レスポンス探索・正規化関数
    deepParse(data, sourceName, logHistory) {
        if (!data) throw new Error('[ERR_NULL_PAYLOAD] レスポンスデータが空です。');

        const rootKeys = Object.keys(data);
        logHistory.push(`[ROOT KEYS] [${rootKeys.join(', ')}]`);

        let charList = null;

        // 1. 一般的な直下キーのチェック (大文字小文字両対応)
        const possibleKeys = [
            'avatarInfoList', 'characters', 'avatarList', 'avatars', 
            'AvatarInfoList', 'Characters', 'AvatarList', 'Avatars'
        ];

        for (const key of possibleKeys) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                charList = data[key];
                logHistory.push(`[MATCH] Found agent array in root key: "${key}"`);
                break;
            }
        }

        // 2. PlayerInfo / playerInfo 内部のチェック
        if (!charList) {
            const pInfo = data.PlayerInfo || data.playerInfo || data.player_info;
            if (pInfo && typeof pInfo === 'object') {
                logHistory.push(`[SEARCH] Searching inside PlayerInfo object...`);
                for (const key of possibleKeys) {
                    if (Array.isArray(pInfo[key]) && pInfo[key].length > 0) {
                        charList = pInfo[key];
                        logHistory.push(`[MATCH] Found agent array inside PlayerInfo."${key}"`);
                        break;
                    }
                }
            }
        }

        // 3. 全プロパティの自動深層探索（フォールバック）
        if (!charList) {
            logHistory.push(`[SEARCH] Performing deep recursive scan...`);
            for (const k in data) {
                if (Array.isArray(data[k]) && data[k].length > 0) {
                    // 配列の先頭要素がオブジェクト構造かチェック
                    if (typeof data[k][0] === 'object' && data[k][0] !== null) {
                        charList = data[k];
                        logHistory.push(`[AUTO DETECT] Array detected at root["${k}"]`);
                        break;
                    }
                }
            }
        }

        if (!charList) {
            throw new Error(`【構造パースエラー】\n${logHistory.join('\n')}\n----------------------------------------\nEnkaレスポンスを受信しましたが、エージェント配列の自動認識に失敗しました。`);
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