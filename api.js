/**
 * Enka / HoYoLAB API データ取得専用モジュール (自動構造解析・柔軟パース対応版)
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

        // --- Proxy 1 試行 ---
        try {
            logHistory.push(`[TRY 1] corsproxy.io...`);
            const res1 = await fetch(proxy1, { signal: AbortSignal.timeout(5000) });
            logHistory.push(`[TRY 1 Status] HTTP ${res1.status}`);

            if (res1.ok) {
                const data = await res1.json();
                return this.smartParse(data, 'Primary Proxy (corsproxy)', logHistory);
            }
        } catch (e) {
            logHistory.push(`[TRY 1 Error] ${e.message}`);
        }

        // --- Proxy 2 試行 ---
        try {
            logHistory.push(`[TRY 2] allorigins.win...`);
            const res2 = await fetch(proxy2, { signal: AbortSignal.timeout(5000) });
            logHistory.push(`[TRY 2 Status] HTTP ${res2.status}`);

            if (res2.ok) {
                const wrapper = await res2.json();
                const data = typeof wrapper.contents === 'string' ? JSON.parse(wrapper.contents) : wrapper.contents;
                return this.smartParse(data, 'Backup Proxy (allorigins)', logHistory);
            }
        } catch (e) {
            logHistory.push(`[TRY 2 Error] ${e.message}`);
        }

        throw new Error(`【通信失敗】\n${logHistory.join('\n')}`);
    },

    parseJsonString(rawJson) {
        let logHistory = [`[DEBUG] Manual JSON Input...`];
        try {
            const data = JSON.parse(rawJson);
            return this.smartParse(data, 'JSON Direct Input', logHistory);
        } catch (e) {
            throw new Error(`[ERR_INVALID_JSON] ${e.message}`);
        }
    },

    // データの階層を自動探索してキャラクター配列を取り出す関数
    smartParse(data, sourceName, logHistory) {
        if (!data) throw new Error('[ERR_NULL_PAYLOAD] レスポンスが空です。');

        logHistory.push(`[ROOT KEYS] [${Object.keys(data).join(', ')}]`);

        // 可能性のあるキー候補を片っ端から探索
        let characters = null;

        if (Array.isArray(data.avatarInfoList)) characters = data.avatarInfoList;
        else if (Array.isArray(data.characters)) characters = data.characters;
        else if (Array.isArray(data.avatarList)) characters = data.avatarList;
        else if (Array.isArray(data.avatars)) characters = data.avatars;
        else if (data.playerInfo && Array.isArray(data.playerInfo.characters)) characters = data.playerInfo.characters;

        // それでも見つからない場合、オブジェクト内部の最初の配列を探索
        if (!characters) {
            for (const key in data) {
                if (Array.isArray(data[key]) && data[key].length > 0) {
                    characters = data[key];
                    logHistory.push(`[AUTO DETECT] Character array found in key: "${key}"`);
                    break;
                }
            }
        }

        if (!characters || characters.length === 0) {
            // 解析不能時の生データ構造出力
            const debugPayload = JSON.stringify(data, null, 2).substring(0, 300);
            throw new Error(`【パースエラー】データ構造の読み込みに失敗しました。\nAPI Response Preview:\n${debugPayload}`);
        }

        logHistory.push(`[SUCCESS] Detected ${characters.length} character(s).`);

        return {
            success: true,
            source: sourceName,
            characters: characters,
            raw: data,
            logs: logHistory.join('\n')
        };
    }
};