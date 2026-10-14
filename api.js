/**
 * Enka API データ取得モジュール (ロリポップ中継 ＆ 深層パース完全対応版)
 */
const ZZZApi = {
    async fetchByUid(uid) {
        if (!uid) {
            throw new Error('[ERR_NO_UID] UIDを入力してください。');
        }

        let logHistory = [`[DEBUG] Target UID: ${uid}`];
        const lolipopProxyUrl = `https://elel.hippy.jp/zzz/tool/proxy.php?uid=${encodeURIComponent(uid)}`;

        try {
            logHistory.push(`[TRY] Fetching via Lolipop Server (elel.hippy.jp)...`);
            
            const res = await fetch(lolipopProxyUrl);
            logHistory.push(`[Status] HTTP ${res.status}`);

            if (!res.ok) {
                throw new Error(`HTTP Error ${res.status}`);
            }

            const data = await res.json();
            return this.deepParse(data, 'Lolipop Proxy Server', logHistory);

        } catch (e) {
            logHistory.push(`[Error] ${e.message}`);
            throw new Error(`【通信失敗】\n${logHistory.join('\n')}\n----------------------------------------\nロリポップサーバーとの通信エラー。proxy.php の設置をご確認ください。`);
        }
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

    // オブジェクトの深層まで再帰的に探索して配列を取り出す関数
    deepParse(data, sourceName, logHistory) {
        if (!data) throw new Error('[ERR_NULL_PAYLOAD] レスポンスが空です。');

        const rootKeys = Object.keys(data);
        logHistory.push(`[ROOT KEYS] [${rootKeys.join(', ')}]`);

        let charList = null;

        // 1. 探索対象となる一般的なキー名（大小文字両対応）
        const candidateKeys = [
            'avatarInfoList', 'characters', 'avatarList', 'avatars',
            'AvatarInfoList', 'Characters', 'AvatarList', 'Avatars', 'characterList'
        ];

        // ルート直下から探す
        for (const key of candidateKeys) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                charList = data[key];
                logHistory.push(`[MATCH] Root key: "${key}"`);
                break;
            }
        }

        // PlayerInfo オブジェクト内部を探す
        if (!charList) {
            const pInfo = data.PlayerInfo || data.playerInfo || data.player_info;
            if (pInfo && typeof pInfo === 'object') {
                for (const key of candidateKeys) {
                    if (Array.isArray(pInfo[key]) && pInfo[key].length > 0) {
                        charList = pInfo[key];
                        logHistory.push(`[MATCH] Inside PlayerInfo."${key}"`);
                        break;
                    }
                }
            }
        }

        // 2. 再帰的深層探索 (あらゆるネスト階層からオブジェクト配列を自動検出)
        if (!charList) {
            const findArrayRecursive = (obj, depth = 0) => {
                if (!obj || typeof obj !== 'object' || depth > 4) return null;

                for (const k in obj) {
                    if (Array.isArray(obj[k]) && obj[k].length > 0) {
                        // 配列の中身がオブジェクト（キャラ情報など）か確認
                        if (typeof obj[k][0] === 'object' && obj[k][0] !== null) {
                            logHistory.push(`[AUTO SCAN] Found array at depth ${depth} (key: "${k}")`);
                            return obj[k];
                        }
                    } else if (typeof obj[k] === 'object' && obj[k] !== null) {
                        const res = findArrayRecursive(obj[k], depth + 1);
                        if (res) return res;
                    }
                }
                return null;
            };

            charList = findArrayRecursive(data);
        }

        if (!charList || charList.length === 0) {
            const preview = JSON.stringify(data, null, 2).substring(0, 300);
            throw new Error(`【構造パースエラー】\n${logHistory.join('\n')}\n----------------------------------------\nデータを受信しましたが、エージェントの配列構造が見つかりませんでした。\nPayload Preview:\n${preview}`);
        }

        logHistory.push(`[SUCCESS] ${charList.length} 件のエージェントデータを抽出しました。`);

        return {
            success: true,
            source: sourceName,
            characters: charList,
            raw: data,
            logs: logHistory.join('\n')
        };
    }
};