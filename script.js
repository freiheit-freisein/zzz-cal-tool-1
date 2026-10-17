/**
 * ゼンゼロ ビルドカード生成 ＆ PTバフ与ダメ比較計算機 (統合版)
 */

// エージェントIDと名前のマッピング辞書 (最新・既存ID対応)
const AGENT_NAME_MAP = {
    1011: 'アンビー', 1021: 'ビリー', 1031: 'ニコ', 1041: '猫又', 1051: 'アンドー',
    1061: 'ベン', 1071: 'クレタ', 1081: 'グレース', 1091: 'ライカン', 1101: 'カリン',
    1111: 'リナ', 1121: 'エレン', 1131: '「11号」', 1141: '蒼角', 1151: '朱鳶',
    1161: '青衣', 1171: 'ジェーン', 1181: 'シーザー', 1191: 'バーニス', 1201: 'セス',
    1211: 'パイパー', 1221: 'ルーシー', 1231: '月城柳', 1241: '浅羽悠真', 1251: '星見雅',
    1261: 'ライト', 1271: 'イヴリン', 1281: 'アストラ', 1291: 'クラレッタ', 1301: '儀玄',
    1401: '星見雅', 1411: '月城柳', 1521: 'アストラ', 1611: 'イヴリン', 1331: '浅羽悠真',
    1701: '浮波 柚葉', 1711: 'アリス', 1721: 'シーシィア', 1731: 'ビビアン'
};

let fetchedCharacters = [];
let selectedCharIndex = 0;

/**
 * 1. UID指定によるデータ取得処理 (CORSプロキシ経由)
 */
async function fetchEnkaData() {
    const uidInput = document.getElementById('uid-input');
    const statusEl = document.getElementById('api-status');
    const uid = uidInput ? uidInput.value.trim() : '';

    if (!uid) {
        if (statusEl) {
            statusEl.innerText = '[ERROR] UIDを入力してください。';
            statusEl.style.color = '#ff5555';
        }
        return;
    }

    if (statusEl) {
        statusEl.innerText = `[CONNECTING] UID: ${uid} のデータを取得中...`;
        statusEl.style.color = '#ffaa00';
    }

    const targetUrl = `https://enka.network/api/zzz/uid/${uid}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();

        // zzz.cards / Enka レスポンスの階層構造パース
        let charList = [];
        if (data.PlayerInfo?.ShowcaseDetail?.AvatarList) {
            charList = data.PlayerInfo.ShowcaseDetail.AvatarList;
        } else if (data.avatarInfoList) {
            charList = data.avatarInfoList;
        } else if (data.characters) {
            charList = data.characters;
        }

        if (!charList || charList.length === 0) {
            if (statusEl) {
                statusEl.innerText = '[WARN] データが取得できませんでした。ゲーム内の「プロフィール公開設定」をご確認ください。';
                statusEl.style.color = '#ff5555';
            }
            return;
        }

        fetchedCharacters = charList;
        if (statusEl) {
            statusEl.innerText = `[SUCCESS] 取得成功！展示エージェント: ${charList.length}体`;
            statusEl.style.color = '#00e676';
        }

        // キャラクター選択カードの描画と初期選択
        renderCharacterSelector(fetchedCharacters);
        selectCharacter(0);

    } catch (err) {
        console.error('Fetch Error:', err);
        if (statusEl) {
            statusEl.innerText = '[FAIL] データ取得に失敗しました。時間をおいて試すかJSON直接入力をご利用ください。';
            statusEl.style.color = '#ff5555';
        }
    }
}

/**
 * 2. エージェントカード一覧のレンダリング
 */
function renderCharacterSelector(characters) {
    const selectorBox = document.getElementById('character-selector');
    const cardList = document.getElementById('character-card-list');

    if (!selectorBox || !cardList) return;
    cardList.innerHTML = '';

    characters.forEach((char, index) => {
        const rawId = char.Id || char.id || char.avatarId;
        const name = AGENT_NAME_MAP[rawId] || char.Name || char.name || `エージェント ${index + 1}`;
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
            min-width: 100px;
            transition: all 0.2s;
        `;
        card.innerHTML = `
            <div style="font-weight: bold; font-size: 0.9rem; color: #fff;">${name}</div>
            <div style="font-size: 0.75rem; color: #aaa;">Lv.${level}</div>
        `;

        card.onclick = () => selectCharacter(index);
        cardList.appendChild(card);
    });

    selectorBox.style.display = 'block';
}

/**
 * 3. 選択したエージェントのビルドカード生成＆表示更新
 */
function selectCharacter(index) {
    selectedCharIndex = index;
    const char = fetchedCharacters[index];
    if (!char) return;

    // カードのハイライト枠線の更新
    renderCharacterSelector(fetchedCharacters);

    const rawId = char.Id || char.id || char.avatarId;
    const agentName = AGENT_NAME_MAP[rawId] || `エージェント ${index + 1}`;
    const level = char.Level || char.level || 60;

    // ビルド概要ヘッダーの反映
    const buildNameEl = document.getElementById('build-agent-name');
    if (buildNameEl) {
        buildNameEl.innerText = `${agentName} (Lv.${level})`;
    }

    // ディスク装着状況の描写
    const discGridEl = document.getElementById('build-disc-grid');
    if (discGridEl && char.EquippedList) {
        discGridEl.innerHTML = '';
        char.EquippedList.forEach(item => {
            const eq = item.Equipment;
            if (!eq) return;

            const slot = item.Slot || '?';
            const discLevel = eq.Level || 0;
            const discCard = document.createElement('div');
            discCard.className = 'disc-mini-card';
            discCard.style.cssText = `
                background: #252832;
                border: 1px solid #3d4252;
                border-radius: 6px;
                padding: 6px 8px;
                font-size: 0.78rem;
            `;
            discCard.innerHTML = `
                <div style="color: #ffaa00; font-weight: bold;">スロット [${slot}] +${discLevel}</div>
                <div style="color: #888; font-size: 0.7rem; margin-top: 2px;">ID: ${eq.Id}</div>
            `;
            discGridEl.appendChild(discCard);
        });
    }

    // 計算処理の実行
    calculateOptimal();
}

/**
 * 4. PTバフ表から数値を合計集計する関数
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
 * 5. 与ダメ＆ステータス増減シミュレーション（リアルタイム実行）
 */
function calculateOptimal() {
    const ptBuffs = getTableBuffTotals();

    // 手動増減（+/-）フォームの値を取得（Null Safe）
    const adjAtkP = parseFloat(document.getElementById('adj-atk-p')?.value || 0);
    const adjCr   = parseFloat(document.getElementById('adj-cr')?.value || 0);
    const adjCd   = parseFloat(document.getElementById('adj-cd')?.value || 0);
    const adjAp   = parseFloat(document.getElementById('adj-ap')?.value || 0);

    // キャラクターの基礎攻撃力（Lv60標準想定: 1521）
    const baseAtk = 1521; 

    // ① 現状ビルド＋PTバフ適用時の標準与ダメ期待値
    const baseFinalAtk = baseAtk * (1 + ptBuffs.atkP / 100) + ptBuffs.atkF;
    const baseCr = Math.min(100, 14.6 + ptBuffs.cr);
    const baseCd = 50 + ptBuffs.cd;
    const baseAp = 248 + ptBuffs.ap;
    const baseCritMult = 1 + (baseCr / 100) * (baseCd / 100);

    const baseDmgExpect = Math.round(baseFinalAtk * baseCritMult * (1 + (baseAp / 100)) * (1 + ptBuffs.dmgP / 100));

    // ② 手動でステータスを増減（比較シミュレーション）させた場合の与ダメ期待値
    const simFinalAtk = baseAtk * (1 + (ptBuffs.atkP + adjAtkP) / 100) + ptBuffs.atkF;
    const simCr = Math.min(100, 14.6 + ptBuffs.cr + adjCr);
    const simCd = 50 + ptBuffs.cd + adjCd;
    const simAp = 248 + ptBuffs.ap + adjAp;
    const simCritMult = 1 + (simCr / 100) * (simCd / 100);

    const simDmgExpect = Math.round(simFinalAtk * simCritMult * (1 + (simAp / 100)) * (1 + ptBuffs.dmgP / 100));

    // 増減差分・変化率（%）の算出
    const diffDmg = simDmgExpect - baseDmgExpect;
    const diffPercent = baseDmgExpect > 0 ? ((diffDmg / baseDmgExpect) * 100).toFixed(2) : '0.00';

    // 結果表示カードの動的更新
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

// ページロード時の自動起動設定
window.addEventListener('DOMContentLoaded', () => {
    calculateOptimal();
});