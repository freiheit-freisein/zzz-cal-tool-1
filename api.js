/**
 * Enka / HoYoLAB API データ取得専用モジュール
 */
const ZZZApi = {
    async fetchByUid(uid) {
        if (!uid) {
            throw new Error('[ERR_NO_UID] UIDを入力してください。');
        }

        const targetUrl = `https://enka.network/api/zzz/uid/${uid}`;
        const proxy1 = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        const proxy2 = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

        let logHistory = [`[DEBUG] Target UID: ${uid}`, `[DEBUG] Target API: ${targetUrl}`];

        try {
            logHistory.push(`[TRY 1] Primary Proxy (corsproxy.io)...`);
            const res1 = await fetch(proxy1, { signal: AbortSignal.timeout(4000) });
            logHistory.push(`[TRY 1 Status] HTTP ${res1.status} ${res1.statusText}`);

            if (res1.ok) {
                const data = await res1.json();
                return this.validateAndParse(data, 'Primary Proxy', logHistory);
            }
        } catch (e) {
            logHistory.push(`[TRY 1 Exception] ${e.name}: ${e.message}`);
        }

        try {
            logHistory.push(`[TRY 2] Backup Proxy (allorigins.win)...`);
            const res2 = await fetch(proxy2, { signal: AbortSignal.timeout(4000) });
            logHistory.push(`[TRY 2 Status] HTTP ${res2.status} ${res2.statusText}`);

            if (res2.ok) {
                const wrapper = await res2.json();
                if (wrapper.contents) {
                    const data = JSON.parse(wrapper.contents);
                    return this.validateAndParse(data, 'Backup Proxy', logHistory);
                }
            }
        } catch (e) {
            logHistory.push(`[TRY 2 Exception] ${e.name}: ${e.message}`);
        }

        throw new Error(`【通信失敗レポート】\n${logHistory.join('\n')}\n----------------------------------------\n[原因] プロキシの不調、またはゲーム内のプロフィール展示が非公開の可能性があります。`);
    },

    parseJsonString(rawJson) {
        let logHistory = [`[DEBUG] Manual JSON Input Parsing...`];
        try {
            const data = JSON.parse(rawJson);
            return this.validateAndParse(data, 'JSON Direct Input', logHistory);
        } catch (e) {
            throw new Error(`[ERR_INVALID_JSON] SyntaxError: ${e.message}\nJSON形式が正しくありません。`);
        }
    },

    validateAndParse(data, sourceName, logHistory) {
        if (!data) throw new Error(`[ERR_NULL_PAYLOAD] 空のデータが返されました。`);

        const charList = data.avatarInfoList || data.characters || data.avatarList;
        if (!charList || !Array.isArray(charList) || charList.length === 0) {
            throw new Error(`【データ未検出】\n${logHistory.join('\n')}\n----------------------------------------\nレスポンスは受信しましたが、展示エージェント情報が含まれていません。ゲーム内公開設定をご確認ください。`);
        }

        logHistory.push(`[SUCCESS] ${charList.length} 件のキャラクター情報を検出しました。`);
        return {
            success: true,
            source: sourceName,
            characters: charList,
            logs: logHistory.join('\n')
        };
    }
};