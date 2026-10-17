/**
 * Enka API データ取得モジュール (ロリポップ自前サーバー中継版)
 */
const ZZZApi = {
    async fetchByUid(uid) {
        if (!uid) {
            throw new Error('[ERR_NO_UID] UIDを入力してください。');
        }

        let logHistory = [`[DEBUG] Target UID: ${uid}`];

        try {
            logHistory.push(`[TRY] Fetching via Lolipop Server (proxy.php)...`);
            
            // 同一ディレクトリ内の proxy.php へリクエスト送信
            const res = await fetch(`proxy.php?uid=${encodeURIComponent(uid)}`);
            logHistory.push(`[Status] HTTP ${res.status}`);

            if (!res.ok) {
                throw new Error(`HTTP Error ${res.status}`);
            }

            const rawText = await res.text();
            let data;
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                throw new Error(`JSONパース失敗: ${e.message}`);
            }

            const parsedResult = this.deepParse(data, 'Lolipop Server Proxy (proxy.php)', logHistory);
            parsedResult.rawText = rawText; // キャッシュ用の生テキストを保持
            return parsedResult;

        } catch (e) {
            logHistory.push(`[Error] ${e.message}`);
            throw new Error(`【通信失敗】\n${logHistory.join('\n')}\n----------------------------------------\nproxy.php との通信に失敗しました。` +
                            `\n・proxy.php が同じフォルダに置かれているか` +
                            `\n・パーミッション設定に問題がないかご確認ください。`);
        }
    },

    parseJsonString(rawJson) {
        let logHistory = [`[DEBUG] Manual JSON Input...`];
        try {
            const data = JSON.parse(rawJson);
            const parsedResult = this.deepParse(data, 'JSON Direct Input', logHistory);
            parsedResult.rawText = rawJson;
            return parsedResult;
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

        // 1. 直下キーの検索
        for (const key of possibleKeys) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                charList = data[key];
                logHistory.push(`[MATCH] Found agents in root key: "${key}"`);
                break;
            }
        }

        // 2. PlayerInfo 内部の検索
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

        // 3. 自動深層検索
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
            throw new Error(`【構造パースエラー】\n${logHistory.join('\n')}\n----------------------------------------\nデータを受信しましたがエージェント配列が見つかりませんでした。`);
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