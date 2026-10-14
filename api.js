/**
 * Enka / HoYoLAB API データ取得専用モジュール（詳細デバッグログ機能付き）
 */
const ZZZApi = {
    async fetchByUid(uid) {
        if (!uid) {
            throw new Error('[ERR_NO_UID] UIDが指定されていません。');
        }

        const targetUrl = `https://enka.network/api/zzz/uid/${uid}`;
        const proxy1 = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        const proxy2 = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

        let logHistory = [`[DEBUG] Target UID: ${uid}`];
        logHistory.push(`[DEBUG] Target API: ${targetUrl}`);

        // --- 試行 1: Primary Proxy (corsproxy.io) ---
        try {
            logHistory.push(`[TRY 1] Fetching via Primary Proxy (corsproxy.io)...`);
            const res1 = await fetch(proxy1, { signal: AbortSignal.timeout(4000) });
            logHistory.push(`[TRY 1 Status] HTTP ${res1.status} ${res1.statusText}`);

            if (res1.ok) {
                const data = await res1.json();
                return this.validateAndParse(data, 'Primary Proxy (corsproxy.io)', logHistory);
            } else {
                logHistory.push(`[TRY 1 Fail] Primary Proxy returned non-200 HTTP code.`);
            }
        } catch (e) {
            logHistory.push(`[TRY 1 Exception] ${e.name}: ${e.message}`);
        }

        // --- 試行 2: Backup Proxy (allorigins.win) ---
        try {
            logHistory.push(`[TRY 2] Fetching via Backup Proxy (allorigins.win)...`);
            const res2 = await fetch(proxy2, { signal: AbortSignal.timeout(4000) });
            logHistory.push(`[TRY 2 Status] HTTP ${res2.status} ${res2.statusText}`);

            if (res2.ok) {
                const wrapper = await res2.json();
                if (!wrapper.contents) {
                    logHistory.push(`[TRY 2 Fail] Proxy connected but 'contents' payload was empty.`);
                } else {
                    const data = JSON.parse(wrapper.contents);
                    return this.validateAndParse(data, 'Backup Proxy (allorigins.win)', logHistory);
                }
            } else {
                logHistory.push(`[TRY 2 Fail] Backup Proxy returned non-200 HTTP code.`);
            }
        } catch (e) {
            logHistory.push(`[TRY 2 Exception] ${e.name}: ${e.message}`);
        }

        // --- 両方失敗した場合の詳細ログ出力 ---
        const errorDetail = [
            `【通信・解析失敗レポート】`,
            ...logHistory,
            `----------------------------------------`,
            `[推測される発生原因]`,
            `1. ブラウザのCORS制限または公開プロキシのブロック (corsproxy/allorigins のダウン)`,
            `2. Enka API側が該当UID (${uid}) のキャッシュを未保持、または404エラー応答`,
            `3. ゲーム「ゼンレスゾーンゼロ」内でのプロフィール/展示エージェント設定が「非公開」`
        ].join('\n');

        throw new Error(errorDetail);
    },

    parseJsonString(rawJson) {
        let logHistory = [`[DEBUG] Manual JSON Input Parsing...`];
        try {
            const data = JSON.parse(rawJson);
            return this.validateAndParse(data, 'JSON Direct Input', logHistory);
        } catch (e) {
            throw new Error(`[ERR_INVALID_JSON] SyntaxError: ${e.message}\n入力されたテキストが正しいJSON形式ではありません。`);
        }
    },

    validateAndParse(data, sourceName, logHistory) {
        logHistory.push(`[PARSE] Validating payload structure...`);

        if (!data) {
            throw new Error(`[ERR_NULL_PAYLOAD] レスポンスデータが空(null/undefined)です。\nLOGS:\n${logHistory.join('\n')}`);
        }

        // Enka APIの主要キー存在チェック
        const keys = Object.keys(data);
        logHistory.push(`[PARSE] Detected Keys in Response: [${keys.join(', ')}]`);

        const charList = data.avatarInfoList || data.characters || data.avatarList;

        if (!charList || !Array.isArray(charList) || charList.length === 0) {
            const missingDetail = [
                `【データ構造不一致エラー】`,
                ...logHistory,
                `----------------------------------------`,
                `[エラー詳細]`,
                `APIからのレスポンスを受信しましたが、エージェント配列(avatarInfoList / characters)が存在しないか空配列です。`,
                `ゲーム内の「プロフィール」->「展示エージェント」が設定されていないか、公開設定がOFFの可能性があります。`
            ].join('\n');

            throw new Error(missingDetail);
        }

        logHistory.push(`[SUCCESS] Found ${charList.length} character(s) in payload.`);

        return {
            success: true,
            source: sourceName,
            raw: data,
            characters: charList,
            logs: logHistory.join('\n')
        };
    }
};