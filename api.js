/**
 * Enka / HoYoLAB API データ取得専用モジュール
 */
const ZZZApi = {
    async fetchByUid(uid) {
        if (!uid) {
            throw new Error('UIDが入力されていません');
        }

        const targetUrl = `https://enka.network/api/zzz/uid/${uid}`;
        const proxy1 = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        const proxy2 = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

        // プロキシ1で試行
        try {
            const res1 = await fetch(proxy1, { signal: AbortSignal.timeout(3000) });
            if (res1.ok) {
                const data = await res1.json();
                if (data && (data.avatarInfoList || data.characters)) {
                    return { success: true, data: data, source: 'Enka API' };
                }
            }
        } catch (e) {
            console.warn('Proxy 1 failed:', e);
        }

        // プロキシ2で試行
        try {
            const res2 = await fetch(proxy2, { signal: AbortSignal.timeout(3000) });
            if (res2.ok) {
                const wrapper = await res2.json();
                const data = JSON.parse(wrapper.contents);
                if (data && (data.avatarInfoList || data.characters)) {
                    return { success: true, data: data, source: 'Enka API (Backup Proxy)' };
                }
            }
        } catch (e) {
            console.warn('Proxy 2 failed:', e);
        }

        throw new Error('API通信が遮断されたか、データが非公開に設定されています');
    },

    parseJsonString(rawJson) {
        try {
            const data = JSON.parse(rawJson);
            return { success: true, data: data, source: 'JSON Input' };
        } catch (e) {
            throw new Error('JSONのフォーマットが不正です');
        }
    }
};