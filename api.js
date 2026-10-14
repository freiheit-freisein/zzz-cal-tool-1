/**
 * Enka API データ取得モジュール (ロリポップ中継 ＆ 深層パース・判定強化版)
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
            throw new Error(e.message);
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

    deepParse(data, sourceName, logHistory) {
        if (!data) throw new Error('[ERR_NULL_PAYLOAD] レスポンスが空です。');

        const rootKeys = Object.keys(data);
        logHistory.push(`[ROOT KEYS] [${rootKeys.join(', ')}]`);

        let charList = null;
        const candidateKeys = [
            'avatarInfoList', 'characters', 'avatarList', 'avatars',
            'AvatarInfoList', 'Characters', 'AvatarList', 'Avatars', 'characterList'
        ];

        // 1. 直下キーの探索
        for (const key of candidateKeys) {
            if (Array.isArray(data[key]) && data[key].length > 0) {
                charList = data[key];
                logHistory.push(`[MATCH] Root key: "${key}"`);
                break;
            }
        }

        // 2. PlayerInfo 内部の探索
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

        // 3. 再帰的深層探索
        if (!charList) {
            const findArrayRecursive = (obj, depth = 0) => {
                if (!obj || typeof obj !== 'object' || depth > 4) return null;

                for (const k in obj) {
                    if (Array.isArray(obj[k]) && obj[k].length > 0) {
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

        // キャラクター配列が存在しない場合
        if (!charList || charList.length === 0) {
            const hasPlayerInfo = rootKeys.includes('PlayerInfo') || rootKeys.includes('playerInfo');
            
            const errorMsg = [
                `【データ未検出エラー】`,
                ...logHistory,
                `----------------------------------------`,
                hasPlayerInfo 
                    ? `・ロリポップ経由でプレイヤーデータ(UID: ${data.uid || '不明'})の通信には成功しましたが、エージェントのステータスデータが含まれていません。`
                    : `・レスポンス内に有効なエージェントデータが見つかりませんでした。`,
                ``,
                `[確認手順]`,
                `1. ゼンレスゾーンゼロの「プロフィール」で「展示エージェント」が正しく設定されているか確認してください。`,
                `2. プロフィール公開設定が「公開」になっているか確認してください。`,
                `※ゲーム内で設定直後の場合、Enka Network側へ反映されるまで数分〜十分程度かかることがあります。`
            ].join('\n');

            throw new Error(errorMsg);
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