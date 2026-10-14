/**
 * Enka / HoYoLAB API データ取得専用モジュール
 */
const ZZZApi = {
    async fetchByUid(uid) {
        if (!uid) {
            throw new Error('UIDを入力してください');
        }

        const targetUrl = `https://enka.network/api/zzz/uid/${uid}`;
        const proxy1 = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        const proxy2 = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;

        // 1. メインプロキシで接続試行
        try {
            const res1 = await fetch(proxy1, { signal: AbortSignal.timeout(4000) });
            if (res1.ok) {
                const data = await res1.json();
                return this.validateAndParse(data, 'Enka API (Primary)');
            }
        } catch (e) {
            console.warn('Primary Proxy failed:', e);
        }

        // 2. サブプロキシ（Backup）で接続試行
        try {
            const res2 = await fetch(proxy2, { signal: AbortSignal.timeout(4000) });
            if (res2.ok) {
                const wrapper = await res2.json();
                const data = JSON.parse(wrapper.contents);
                return this.validateAndParse(data, 'Enka API (Backup)');
            }
        } catch (e) {
            console.warn('Backup Proxy failed:', e);
        }

        throw new Error('API通信が遮断されたか、ゲーム側でプロフィール展示が非公開に設定されています');
    },

    parseJsonString(rawJson) {
        try {
            const data = JSON.parse(rawJson);
            return this.validateAndParse(data, 'JSON直貼り');
        } catch (e) {
            throw new Error('JSONのフォーマットが不正です');
        }
    },

    validateAndParse(data, sourceName) {
        if (!data || (!data.avatarInfoList && !data.characters && !data.playerInfo)) {
            throw new Error('有効なエージェントデータが検出されませんでした');
        }

        // キャラクター/ステータスデータの抽出処理
        const charList = data.avatarInfoList || data.characters || [];
        return {
            success: true,
            source: sourceName,
            raw: data,
            characters: charList
        };
    }
};