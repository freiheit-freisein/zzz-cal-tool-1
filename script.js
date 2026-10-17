/**
 * ゼンゼロ ビルド＆PTバフ与ダメ比較計算制御 (ロリポップ連携・キャッシュ対応版)
 */

// キャラクターIDと表示名のマッピング辞書
const AGENT_NAME_MAP = {
    1011: 'アンビー', 1021: 'ビリー', 1031: 'ニコ', 1041: '猫又', 1051: 'アンドー',
    1061: 'ベン', 1071: 'クレタ', 1081: 'グレース', 1091: 'ライカン', 1101: 'カリン',
    1111: 'リナ', 1121: 'エレン', 1131: '「11号」', 1141: '蒼角', 1151: '朱鳶',
    1161: '青衣', 1171: 'ジェーン', 1181: 'シーザー', 1191: 'バーニス', 1201: 'セス',
    1211: 'パイパー', 1221: 'ルーシー', 1231: '月城柳', 1241: '浅羽悠真', 1251: '星見雅',
    1261: 'ライト', 1271: 'イヴリン', 1281: 'アストラ', 1291: 'クラレッタ', 1301: '儀玄',
    1331: '浅羽悠真', 1401: '星見雅', 1411: '月城柳', 1521: 'アストラ', 1611: 'イヴリン',
    1701: '浮波 柚葉', 1711: 'アリス', 1721: 'シーシィア', 1731: 'ビビアン'
};

let fetchedCharacters = [];
let selectedCharIndex = 0;

// 初期化（保存されたUIDの自動補完）
window.addEventListener('DOMContentLoaded', () => {
    const savedUid = localStorage.getItem('zzz_saved_uid');
    if (savedUid) {
        const uidInput = document.getElementById('uid-input');
        if (uidInput) uidInput.value = savedUid;
    }
    calculateOptimal();
});

/**
 * UID自動取得 (3分間キャッシュ機能付き)
 */
async function fetchEnkaData() {
    const uidInput = document.getElementById('uid-input');
    const statusEl = document.getElementById('api-status');
    const uid = uidInput ? uidInput.value.trim() : '';

    if (!uid) {
        if (statusEl) statusEl.innerText = '[ERROR] UIDを入力してください。';
        return;
    }

    // UIDのローカル保存
    localStorage.setItem('zzz_saved_uid', uid);

    // 3分間（180秒）キャッシュの確認
    const now = Date.now();
    const cacheKey = `zzz_cache_${uid}`;
    const cachedTime = localStorage.getItem(`${cacheKey}_time`);
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedTime && cachedData && (now - parseInt(cachedTime) < 180000)) {
        const remainingSec = Math.ceil((180000 - (now - parseInt(cachedTime))) / 1000);
        if (statusEl) {
            statusEl.innerText = `[CACHE] 前回の取得から3分経過していないため、保存されたキャッシュを使用します。(再取得可能まで: 約${remainingSec}秒)\n` +
                                `ソース: Local Cache`;
            statusEl.style.color = '#00e676';
        }
        try {
            const parsed = ZZZApi.parseJsonString(cachedData);
            handleFetchSuccess(parsed);
            return;
        } catch (e) {
            console.warn('Cache parse failed, refetching...');
        }
    }

    if (statusEl) {
        statusEl.innerText = `[CONNECTING] elel.hippy.jp/zzz/tool/proxy.php 経由で UID: ${uid} を取得中...`;
        statusEl.style.color = '#ffaa00';
    }

    try {
        const result = await ZZZApi.fetchByUid(uid);
        
        // キャッシュの保存
        if (result.rawText) {
            localStorage.setItem(cacheKey, result.rawText);
            localStorage.setItem(`${cacheKey}_time`, now.toString());
        }

        if (statusEl) {
            statusEl.innerText = `[SUCCESS] 取得成功 (${result.source})\nLOGS:\n${result.logs}`;
            statusEl.style.color = '#00e676';
        }

        handleFetchSuccess(result);

    } catch (err) {
        if (statusEl) {
            statusEl.innerText = err.message;
            statusEl.style.color = '#ff5555';
        }
    }
}

function handleFetchSuccess(result) {
    fetchedCharacters = result.characters || [];
    renderCharacterSelector(fetchedCharacters);
    selectCharacter(0);
}

/**
 * 取得したキャラクターカードの描画
 */
function renderCharacterSelector(characters) {
    const selectorBox = document.getElementById('character-selector');
    const cardList = document.getElementById('character-card-list');

    if (!selectorBox || !cardList) return;
    cardList.innerHTML = '';

    characters.forEach((char, index) => {
        const rawId = char.Id || char.id || char.avatarId;
        const name = AGENT_NAME_MAP[rawId] || char.Name || char.name || `エージェント (${rawId || index + 1})`;
        const level = char.Level || char.level || 60;

        const card = document.createElement('div');
        card.className = 'char-card';
        card.style.cssText = `
            background: #252830;
            border: 2px solid ${index === selectedCharIndex ? '#ffaa00' : '#3a3f4d'};
            border-radius: 8px;
            padding: 8px 12px;
            cursor: pointer;
            text-align: center;
            min-width: 95px;
            transition: all 0.2s;
        `;
        card.innerHTML = `
            <div style="font-weight: bold; font-size: 0.88rem; color: #fff;">${name}</div>
            <div style="font-size: 0.75rem; color: #aaa;">Lv.${level}</div>
        `;

        card.onclick = () => selectCharacter(index);
        cardList.appendChild(card);
    });

    selectorBox.style.display = 'block';
}

/**
 * キャラクター選択・反映処理
 */
function selectCharacter(index) {
    selectedCharIndex = index;
    const char = fetchedCharacters[index];
    if (!char) return;

    renderCharacterSelector(fetchedCharacters);

    const rawId = char.Id || char.id || char.avatarId;
    const agentName = AGENT_NAME_MAP[rawId] || `エージェント (${rawId || index + 1})`;
    const level = char.Level || char.level || 60;

    const buildNameEl = document.getElementById('build-agent-name');
    if (buildNameEl) {
        buildNameEl.innerText = `${agentName} (Lv.${level})`;
    }

    // ディスク装着状況のレンダリング
    const discGridEl = document.getElementById('build-disc-grid');
    if (discGridEl) {
        discGridEl.innerHTML = '';
        const eqList = char.EquippedList || char.equippedList || [];
        
        eqList.forEach(item => {
            const eq = item.Equipment || item;
            if (!eq) return;

            const slot = item.Slot || item.slot || '?';
            const discLevel = eq.Level || eq.level || 0;
            const discCard = document.createElement('div');
            discCard.style.cssText = `
                background: #252832;
                border: 1px solid #3d4252;
                border-radius: 6px;
                padding: 6px 8px;
                font-size: 0.75rem;
            `;
            discCard.innerHTML = `
                <div style="color: #ffaa00; font-weight: bold;">スロット [${slot}] +${discLevel}</div>
                <div style="color: #888; font-size: 0.7rem; margin-top: 2px;">ID: ${eq.Id || eq.id || '-'}</div>
            `;
            discGridEl.appendChild(discCard);
        });
    }

    calculateOptimal();
}

/**
 * キャッシュされているJSON原文をテキストエリアへ出力表示する関数
 */
function exportCachedJson() {
    const uidInput = document.getElementById('uid-input');
    const uid = uidInput ? uidInput.value.trim() : '';
    if (!uid) {
        alert('UIDを入力してください');
        return;
    }

    const cacheKey = `zzz_cache_${uid}`;
    const cachedData = localStorage.getItem(cacheKey);

    const jsonBox = document.getElementById('json-box');
    const jsonInput = document.getElementById('json-input');

    if (!cachedData) {
        alert('保存されたキャッシュデータがありません。先に「UID自動取得」を実行してください。');
        return;
    }

    if (jsonBox && jsonInput) {
        jsonBox.style.display = 'block';
        try {
            // 見やすいように整形して表示
            jsonInput.value = JSON.stringify(JSON.parse(cachedData), null, 2);
        } catch (e) {
            jsonInput.value = cachedData;
        }
    }
}

/**
 * PTバフ合計数値の収集
 */
function getTableBuffTotals() {
    let totals = { atkP: 0, atkF: 0, dmgP: 0, cr: 0, cd: 0, ap: 0, pen: 0 };
    const rows = document.querySelectorAll('#buff-table-body tr');

    rows.forEach(row => {
        const enableInput = row.querySelector('.buff-enable');
        if (enableInput && !enableInput.checked) return;

        totals.atkP += parseFloat(row.querySelector('.buff-atk-p')?.value || 0);
        totals.atkF += parseFloat(row.querySelector('.buff-atk-f')?.value || 0);
        totals.dmgP += parseFloat(row.querySelector('.buff-dmg-p')?.value || 0);
        totals.cr   += parseFloat(row.querySelector('.buff-cr')?.value || 0);
        totals.cd   += parseFloat(row.querySelector('.buff-cd')?.value || 0);
        totals.ap   += parseFloat(row.querySelector('.buff-ap')?.value || 0);
        totals.pen  += parseFloat(row.querySelector('.buff-pen')?.value || 0);
    });

    return totals;
}

/**
 * 与ダメ計算およびステータス調整シミュレーション
 */
function calculateOptimal() {
    const ptBuffs = getTableBuffTotals();

    const adjAtkP = parseFloat(document.getElementById('adj-atk-p')?.value || 0);
    const adjCr   = parseFloat(document.getElementById('adj-cr')?.value || 0);
    const adjCd   = parseFloat(document.getElementById('adj-cd')?.value || 0);
    const adjAp   = parseFloat(document.getElementById('adj-ap')?.value || 0);

    const baseAtk = 1521; 

    // ① PTバフのみ適用時の標準期待値
    const baseFinalAtk = baseAtk * (1 + ptBuffs.atkP / 100) + ptBuffs.atkF;
    const baseCr = Math.min(100, 14.6 + ptBuffs.cr);
    const baseCd = 50 + ptBuffs.cd;
    const baseAp = 248 + ptBuffs.ap;
    const baseCritMult = 1 + (baseCr / 100) * (baseCd / 100);

    const baseDmgExpect = Math.round(baseFinalAtk * baseCritMult * (1 + (baseAp / 100)) * (1 + ptBuffs.dmgP / 100));

    // ② 微調整ステータス増減適用後の期待値
    const simFinalAtk = baseAtk * (1 + (ptBuffs.atkP + adjAtkP) / 100) + ptBuffs.atkF;
    const simCr = Math.min(100, 14.6 + ptBuffs.cr + adjCr);
    const simCd = 50 + ptBuffs.cd + adjCd;
    const simAp = 248 + ptBuffs.ap + adjAp;
    const simCritMult = 1 + (simCr / 100) * (simCd / 100);

    const simDmgExpect = Math.round(simFinalAtk * simCritMult * (1 + (simAp / 100)) * (1 + ptBuffs.dmgP / 100));

    const diffDmg = simDmgExpect - baseDmgExpect;
    const diffPercent = baseDmgExpect > 0 ? ((diffDmg / baseDmgExpect) * 100).toFixed(2) : '0.00';

    const simBox = document.getElementById('sim-comparison');
    if (simBox) {
        simBox.innerHTML = `
            <div style="font-size: 0.95rem; margin-bottom: 6px; color: #ccc;">
                PTバフ適用時 与ダメ期待値: <strong style="color: #00e676; font-size: 1.1rem;">${baseDmgExpect.toLocaleString()}</strong>
            </div>
            <div style="font-size: 1.15rem; font-weight: bold; color: ${diffDmg >= 0 ? '#ffaa00' : '#ff5555'};">
                調整後 与ダメ期待値: ${simDmgExpect.toLocaleString()} 
                <span style="font-size: 0.88rem; margin-left: 5px;">(${diffDmg >= 0 ? '+' : ''}${diffDmg.toLocaleString()} / ${diffDmg >= 0 ? '+' : ''}${diffPercent}%)</span>
            </div>
            <div style="font-size: 0.78rem; color: #888; margin-top: 8px;">
                ※PTバフ表の有効設定およびステータス微調整の数値をリアルタイム合成しています。
            </div>
        `;
    }
}