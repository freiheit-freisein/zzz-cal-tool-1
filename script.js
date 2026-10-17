/**
 * ゼンゼロ ダメージ計算＆UI制御モジュール (キャラ名マッピング更新＆安全連動修正版)
 */

// エージェントIDとキャラ名の対応辞書 (最新環境対応)
const AGENT_NAME_MAP = {
    1011: 'アンビー', 1021: 'ビリー', 1031: 'ニコ', 1041: '猫又', 1051: 'アンドー',
    1061: 'ベン', 1071: 'クレタ', 1081: 'グレース', 1091: 'ライカン', 1101: 'カリン',
    1111: 'リナ', 1121: 'エレン', 1131: '「11号」', 1141: '蒼角', 1151: '朱鳶',
    1161: '青衣', 1171: 'ジェーン', 1181: 'シーザー', 1191: 'バーニス', 1201: 'セス',
    1211: 'パイパー', 1221: 'ルーシー', 1231: '月城柳', 1241: '浅羽悠真', 1251: '星見雅',
    1261: 'ライト', 1271: 'イヴリン', 1281: 'アストラ', 1291: 'クラレッタ', 1301: '儀玄',
    1331: '浅羽悠真', 1401: '星見雅', 1411: '月城柳', 1521: 'アストラ', 1611: 'イヴリン'
};

const PRESETS = {
    claretta: { role: '鋭御', baseDef: 1100, critRate: 20, critDmg: 60, d4: 'crit_rate', d5: 'elem_bonus', d6: 'def_percent' },
    jane: { role: '異常', baseAtk: 1593, baseAp: 148, d4: 'ap', d5: 'elem_bonus', d6: 'anom_am' },
    zhu_yuan: { role: '強攻', baseAtk: 1710, critRate: 5, critDmg: 50, d4: 'crit_dmg', d5: 'elem_bonus', d6: 'atk_percent' },
    gigen: { role: '命破', baseHp: 12500, critRate: 5, critDmg: 50, d4: 'crit_rate', d5: 'hp_percent', d6: 'hp_percent' }
};

let fetchedCharacters = [];
const COOLDOWN_MS = 3 * 60 * 1000;

function toggleJsonInput() {
    const box = document.getElementById('json-box');
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function applyPreset() {
    const agentKey = document.getElementById('agent-select').value;
    const data = PRESETS[agentKey];
    const roleDisplay = document.getElementById('role-display');
    if (roleDisplay) {
        roleDisplay.innerText = `特性: ${data.role}型${data.role === '鋭御' ? ' (多重会心モデル適用)' : ''}`;
    }
    
    const container = document.getElementById('dynamic-inputs');
    if (!container) return;
    container.innerHTML = '';

    if (data.role === '鋭御') {
        container.innerHTML = `
            <div class="form-group"><label>基礎防御力</label><input type="number" id="base-def" value="${data.baseDef}" onchange="calculateOptimal()"></div>
            <div class="form-group"><label>基礎会心率 (%)</label><input type="number" id="base-cr" value="${data.critRate}" onchange="calculateOptimal()"></div>
            <div class="form-group"><label>基礎会心ダメージ (%)</label><input type="number" id="base-cd" value="${data.critDmg}" onchange="calculateOptimal()"></div>
        `;
    } else if (data.role === '強攻') {
        container.innerHTML = `
            <div class="form-group"><label>基礎攻撃力</label><input type="number" id="base-atk" value="${data.baseAtk}" onchange="calculateOptimal()"></div>
            <div class="form-group"><label>基礎会心率 (%)</label><input type="number" id="base-cr" value="${data.critRate}" onchange="calculateOptimal()"></div>
            <div class="form-group"><label>基礎会心ダメージ (%)</label><input type="number" id="base-cd" value="${data.critDmg}" onchange="calculateOptimal()"></div>
        `;
    } else if (data.role === '異常') {
        container.innerHTML = `
            <div class="form-group"><label>基礎攻撃力</label><input type="number" id="base-atk" value="${data.baseAtk}" onchange="calculateOptimal()"></div>
            <div class="form-group"><label>基礎異常マスタリー</label><input type="number" id="base-ap" value="${data.baseAp}" onchange="calculateOptimal()"></div>
        `;
    } else if (data.role === '命破') {
        container.innerHTML = `
            <div class="form-group"><label>基礎HP</label><input type="number" id="base-hp" value="${data.baseHp}" onchange="calculateOptimal()"></div>
            <div class="form-group"><label>基礎会心率 (%)</label><input type="number" id="base-cr" value="${data.critRate}" onchange="calculateOptimal()"></div>
            <div class="form-group"><label>基礎会心ダメージ (%)</label><input type="number" id="base-cd" value="${data.critDmg}" onchange="calculateOptimal()"></div>
        `;
    }

    const d4 = document.getElementById('disc4-main');
    const d5 = document.getElementById('disc5-main');
    const d6 = document.getElementById('disc6-main');
    if (d4) d4.value = data.d4;
    if (d5) d5.value = data.d5;
    if (d6) d6.value = data.d6;
    calculateOptimal();
}

function calculateOptimal() {
    const agentKey = document.getElementById('agent-select').value;
    const role = PRESETS[agentKey].role;
    const buff = parseFloat(document.getElementById('buff-percent')?.value || 0);

    const enemyLv = parseFloat(document.getElementById('enemy-level')?.value || 60);
    const enemyRes = parseFloat(document.getElementById('enemy-res')?.value || 0);
    const stunMult = parseFloat(document.getElementById('stun-mult')?.value || 1.5);

    const d4 = document.getElementById('disc4-main')?.value;
    const d5 = document.getElementById('disc5-main')?.value;
    const d6 = document.getElementById('disc6-main')?.value;

    let addAtkP = 0, addHpP = 0, addDefP = 0, addAp = 0, addCr = 0, addCd = 0, addElem = 0, addPenP = 0, addAm = 0;

    [d4, d5, d6].forEach(stat => {
        if (stat === 'atk_percent') addAtkP += 30;
        if (stat === 'hp_percent') addHpP += 30;
        if (stat === 'def_percent') addDefP += 30;
        if (stat === 'ap') addAp += 92;
        if (stat === 'crit_rate') addCr += 24;
        if (stat === 'crit_dmg') addCd += 48;
        if (stat === 'elem_bonus') addElem += 30;
        if (stat === 'pen_percent') addPenP += 24;
        if (stat === 'anom_am') addAm += 30;
    });

    const attackerLvConst = 794;
    const enemyDef = (enemyLv * 15 + 50) * (1 - addPenP / 100);
    const defMultiplier = attackerLvConst / (enemyDef + attackerLvConst);
    const resMultiplier = 1 - (enemyRes / 100);

    let finalDamage = 0;
    let statsSummary = '';

    if (role === '鋭御') {
        const baseDef = parseFloat(document.getElementById('base-def')?.value || 0);
        const baseCr = parseFloat(document.getElementById('base-cr')?.value || 5);
        const baseCd = parseFloat(document.getElementById('base-cd')?.value || 50);

        const finalDef = baseDef * (1 + (addDefP + buff) / 100);
        const finalCr = baseCr + addCr;
        const finalCd = baseCd + addCd;

        let critMultiplier = 1;
        if (finalCr <= 100) {
            critMultiplier = 1 + (finalCr / 100) * (finalCd / 100);
        } else {
            const overflowCr = finalCr - 100;
            critMultiplier = (1 + finalCd / 100) + (overflowCr / 100) * (finalCd / 100);
        }

        const skillDmg = finalDef * 2.0;
        finalDamage = Math.round(skillDmg * critMultiplier * (1 + addElem / 100) * defMultiplier * resMultiplier * stunMult);

        statsSummary = `
            <div><strong>参照防御力:</strong> ${Math.round(finalDef)}</div>
            <div><strong>会心乗数 (多重適用):</strong> ×${critMultiplier.toFixed(3)} (会心率: ${finalCr}%)</div>
            <div><strong>防御減衰乗数:</strong> ×${defMultiplier.toFixed(3)} (貫通率: ${addPenP}%)</div>
            <div><strong>与ダメ・ブレイク乗数:</strong> ×${((1 + addElem / 100) * stunMult).toFixed(2)}</div>
        `;
    } else if (role === '強攻') {
        const baseAtk = parseFloat(document.getElementById('base-atk')?.value || 0);
        const baseCr = parseFloat(document.getElementById('base-cr')?.value || 5);
        const baseCd = parseFloat(document.getElementById('base-cd')?.value || 50);

        const finalAtk = baseAtk * (1 + (addAtkP + buff) / 100);
        const finalCr = Math.min(100, baseCr + addCr);
        const finalCd = baseCd + addCd;

        const critMultiplier = 1 + (finalCr / 100) * (finalCd / 100);
        const skillDmg = finalAtk * 2.0;
        finalDamage = Math.round(skillDmg * critMultiplier * (1 + addElem / 100) * defMultiplier * resMultiplier * stunMult);

        statsSummary = `
            <div><strong>参照攻撃力:</strong> ${Math.round(finalAtk)}</div>
            <div><strong>会心乗数:</strong> ×${critMultiplier.toFixed(3)} (会心率: ${finalCr}%)</div>
            <div><strong>防御減衰乗数:</strong> ×${defMultiplier.toFixed(3)}</div>
        `;
    } else if (role === '異常') {
        const baseAtk = parseFloat(document.getElementById('base-atk')?.value || 0);
        const baseAp = parseFloat(document.getElementById('base-ap')?.value || 0);

        const finalAtk = baseAtk * (1 + (addAtkP + buff) / 100);
        const finalAp = baseAp + addAp;

        const anomalyMult = 1 + (finalAp / 100);
        finalDamage = Math.round(finalAtk * anomalyMult * (1 + addElem / 100) * (1 + addAm / 100) * defMultiplier * resMultiplier);

        statsSummary = `
            <div><strong>参照攻撃力:</strong> ${Math.round(finalAtk)}</div>
            <div><strong>異常マスタリー補正:</strong> ×${anomalyMult.toFixed(3)} (${finalAp})</div>
            <div><strong>防御減衰乗数:</strong> ×${defMultiplier.toFixed(3)}</div>
        `;
    } else if (role === '命破') {
        const baseHp = parseFloat(document.getElementById('base-hp')?.value || 0);
        const baseCr = parseFloat(document.getElementById('base-cr')?.value || 5);
        const baseCd = parseFloat(document.getElementById('base-cd')?.value || 50);

        const finalHp = baseHp * (1 + (addHpP + buff) / 100);
        const finalCr = Math.min(100, baseCr + addCr);
        const finalCd = baseCd + addCd;

        const critMultiplier = 1 + (finalCr / 100) * (finalCd / 100);
        const skillDmg = finalHp * 0.25;
        finalDamage = Math.round(skillDmg * critMultiplier * (1 + addElem / 100) * defMultiplier * resMultiplier * stunMult);

        statsSummary = `
            <div><strong>参照HP:</strong> ${Math.round(finalHp)}</div>
            <div><strong>会心乗数:</strong> ×${critMultiplier.toFixed(3)}</div>
            <div><strong>防御減衰乗数:</strong> ×${defMultiplier.toFixed(3)}</div>
        `;
    }

    const totalStatsEl = document.getElementById('total-stats');
    const optDetailsEl = document.getElementById('opt-details');
    if (totalStatsEl) totalStatsEl.innerHTML = statsSummary;
    if (optDetailsEl) {
        optDetailsEl.innerHTML = `
            <div>想定ダメージ期待値: <strong>${finalDamage.toLocaleString()}</strong></div>
            <div style="font-size: 0.85rem; color: #aaa; margin-top: 5px;">※敵Lv.${enemyLv}・耐性${enemyRes}%・ブレイク(${stunMult}倍)での公式減衰反映値です。</div>
        `;
    }
}

function getAgentName(char, index) {
    const rawId = char.id || char.avatarId || char.AvatarId || char.agentId || char.Id;
    if (rawId && AGENT_NAME_MAP[rawId]) {
        return AGENT_NAME_MAP[rawId];
    }
    return char.name || char.Name || `エージェント ${index + 1}`;
}

function renderCharacterSelector(characters) {
    fetchedCharacters = characters;
    const selectorBox = document.getElementById('character-selector');
    const cardList = document.getElementById('character-card-list');

    if (!selectorBox || !cardList) return;

    cardList.innerHTML = '';

    characters.forEach((char, index) => {
        const name = getAgentName(char, index);
        const level = char.level || char.Level || 60;

        const card = document.createElement('div');
        card.className = 'char-card';
        card.style.cssText = `
            background: #252830;
            border: 1px solid #3a3f4d;
            border-radius: 8px;
            padding: 10px 14px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
            min-width: 100px;
        `;
        card.innerHTML = `
            <div style="font-weight: bold; font-size: 0.95rem; color: #fff;">${name}</div>
            <div style="font-size: 0.75rem; color: #aaa; margin-top: 3px;">Lv.${level}</div>
        `;

        card.onmouseover = () => card.style.borderColor = '#ffaa00';
        card.onmouseout = () => {
            if (!card.classList.contains('selected')) card.style.borderColor = '#3a3f4d';
        };
        card.onclick = () => selectCharacter(index);

        cardList.appendChild(card);
    });

    selectorBox.style.display = 'block';
}

function extractStatValue(obj, keys) {
    if (!obj || typeof obj !== 'object') return 0;
    const targets = [obj, obj.stats, obj.fightProp, obj.Properties, obj.property, obj.baseProperties, obj.propMap, obj.combatStats];

    for (const target of targets) {
        if (!target || typeof target !== 'object') continue;
        for (const k of keys) {
            if (target[k] !== undefined && target[k] !== null) {
                const val = target[k];
                if (typeof val === 'object') {
                    const extracted = val.value ?? val.val ?? val.current ?? 0;
                    if (extracted) return parseFloat(extracted);
                } else if (typeof val === 'number' || typeof val === 'string') {
                    const parsed = parseFloat(val);
                    if (!isNaN(parsed)) return parsed;
                }
            }
        }
    }
    return 0;
}

/**
 * キャラクターカードクリック時の処理：選択 ＆ 安全なフォーム連動
 */
function selectCharacter(index) {
    const char = fetchedCharacters[index];
    if (!char) return;

    // キャラ名から自動で特性（プリセット）を判定・切り替え
    const name = getAgentName(char, index);
    const agentSelect = document.getElementById('agent-select');
    if (agentSelect) {
        if (name.includes('クラレッタ')) agentSelect.value = 'claretta';
        else if (name.includes('ジェーン') || name.includes('柳') || name.includes('バーニス')) agentSelect.value = 'jane';
        else if (name.includes('朱鳶') || name.includes('エレン')) agentSelect.value = 'zhu_yuan';
        else if (name.includes('儀玄')) agentSelect.value = 'gigen';
        applyPreset();
    }

    // 各種ステータスの抽出
    const atk = extractStatValue(char, ['atk', 'BASE_ATK', '1', 1, 'Atk', 'Attack']);
    const def = extractStatValue(char, ['def', 'BASE_DEF', '3', 3, 'Def', 'Defense']);
    const hp = extractStatValue(char, ['hp', 'BASE_HP', '2', 2, 'Hp', 'HP']);
    const cr = extractStatValue(char, ['critRate', 'CRITICAL', '20', 20, 'CritRate', 'crit_rate']);
    const cd = extractStatValue(char, ['critDmg', 'CRITICAL_HURT', '22', 22, 'CritDmg', 'crit_dmg']);
    const ap = extractStatValue(char, ['elementMastery', 'AP', '31', 31, 'AnomProf', 'anomalyProficiency']);

    // 画面上に存在する入力欄だけに安全に数値をセット
    const atkEl = document.getElementById('base-atk');
    const defEl = document.getElementById('base-def');
    const hpEl = document.getElementById('base-hp');
    const crEl = document.getElementById('base-cr');
    const cdEl = document.getElementById('base-cd');
    const apEl = document.getElementById('base-ap');

    if (atkEl && atk) atkEl.value = Math.round(atk);
    if (defEl && def) defEl.value = Math.round(def);
    if (hpEl && hp) hpEl.value = Math.round(hp);
    if (crEl && cr) crEl.value = (cr > 1 ? cr : cr * 100).toFixed(1);
    if (cdEl && cd) cdEl.value = (cd > 1 ? cd : cd * 100).toFixed(1);
    if (apEl && ap) apEl.value = Math.round(ap);

    const cards = document.querySelectorAll('#character-card-list .char-card');
    cards.forEach((c, i) => {
        if (i === index) {
            c.classList.add('selected');
            c.style.backgroundColor = '#383d4c';
            c.style.borderColor = '#00e676';
        } else {
            c.classList.remove('selected');
            c.style.backgroundColor = '#252830';
            c.style.borderColor = '#3a3f4d';
        }
    });

    calculateOptimal();
}

async function fetchEnkaData() {
    const uidInput = document.getElementById('uid-input');
    const statusEl = document.getElementById('api-status');
    const uid = uidInput ? uidInput.value.trim() : '';

    if (!uid) {
        if (statusEl) {
            statusEl.innerText = '[ERR] UIDを入力してください。';
            statusEl.style.color = '#ff5555';
        }
        return;
    }

    localStorage.setItem('zzz_saved_uid', uid);

    const now = Date.now();
    const lastFetchTime = parseInt(localStorage.getItem(`zzz_last_fetch_time_${uid}`) || '0', 10);
    const cachedRawText = localStorage.getItem(`zzz_raw_json_${uid}`);

    if (now - lastFetchTime < COOLDOWN_MS && cachedRawText) {
        const remainingSec = Math.ceil((COOLDOWN_MS - (now - lastFetchTime)) / 1000);
        try {
            const cachedResult = ZZZApi.parseJsonString(cachedRawText);
            if (statusEl) {
                statusEl.innerText = `[CACHE] 前回の取得から3分経過していないため、ローカルキャッシュを使用します。(残り ${remainingSec} 秒)\n[SUCCESS] ${cachedResult.source}`;
                statusEl.style.color = '#00e676';
            }
            renderCharacterSelector(cachedResult.characters);
            selectCharacter(0);
            return;
        } catch (e) {}
    }

    if (statusEl) {
        statusEl.innerText = '[通信開始] Lolipop Proxy 経由で同期中...';
        statusEl.style.color = '#ffaa00';
    }

    try {
        const result = await ZZZApi.fetchByUid(uid);
        localStorage.setItem(`zzz_last_fetch_time_${uid}`, Date.now().toString());
        localStorage.setItem(`zzz_raw_json_${uid}`, result.rawText);

        if (statusEl) {
            statusEl.innerText = `[SUCCESS] ${result.source}\n${result.logs}`;
            statusEl.style.color = '#00e676';
        }

        renderCharacterSelector(result.characters);
        selectCharacter(0);

    } catch (err) {
        if (statusEl) {
            statusEl.innerText = err.message || err;
            statusEl.style.color = '#ff5555';
        }
    }
}

function importJsonData() {
    const statusEl = document.getElementById('api-status');
    const rawInput = document.getElementById('json-input');
    const raw = rawInput ? rawInput.value.trim() : '';

    if (!statusEl) return;

    try {
        const result = ZZZApi.parseJsonString(raw);
        if (statusEl) {
            statusEl.innerText = `[SUCCESS] ${result.source}\n${result.logs}`;
            statusEl.style.color = '#00e676';
        }
        renderCharacterSelector(result.characters);
        selectCharacter(0);

    } catch (err) {
        if (statusEl) {
            statusEl.innerText = err.message || err;
            statusEl.style.color = '#ff5555';
        }
    }
}

function exportCachedJson() {
    const uidInput = document.getElementById('uid-input');
    const uid = uidInput ? uidInput.value.trim() : '';
    const statusEl = document.getElementById('api-status');
    const jsonInput = document.getElementById('json-input');
    const jsonBox = document.getElementById('json-box');

    if (!uid) {
        alert('UIDが入力されていません。');
        return;
    }

    const cachedRawText = localStorage.getItem(`zzz_raw_json_${uid}`);
    if (!cachedRawText) {
        alert(`UID: ${uid} のキャッシュされたJSONデータが見つかりません。先に「UID自動取得」を実行してください。`);
        return;
    }

    if (jsonBox) jsonBox.style.display = 'block';
    if (jsonInput) {
        try {
            const jsonObj = JSON.parse(cachedRawText);
            jsonInput.value = JSON.stringify(jsonObj, null, 2);
        } catch (e) {
            jsonInput.value = cachedRawText;
        }
    }

    if (statusEl) {
        statusEl.innerText = `[INFO] UID: ${uid} のキャッシュJSON原文をテキストエリアに出力しました。`;
        statusEl.style.color = '#00bcd4';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    applyPreset();
    const savedUid = localStorage.getItem('zzz_saved_uid');
    const uidInput = document.getElementById('uid-input');
    if (savedUid && uidInput) {
        uidInput.value = savedUid;
    }
});