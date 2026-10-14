/**
 * ゼンゼロ ダメージ計算＆UI制御モジュール
 */
const PRESETS = {
    claretta: { role: '鋭御', baseDef: 1100, critRate: 20, critDmg: 60, d4: 'crit_rate', d5: 'elem_bonus', d6: 'def_percent' },
    jane: { role: '異常', baseAtk: 1593, baseAp: 148, d4: 'ap', d5: 'elem_bonus', d6: 'anom_am' },
    zhu_yuan: { role: '強攻', baseAtk: 1710, critRate: 5, critDmg: 50, d4: 'crit_dmg', d5: 'elem_bonus', d6: 'atk_percent' },
    gigen: { role: '命破', baseHp: 12500, critRate: 5, critDmg: 50, d4: 'crit_rate', d5: 'hp_percent', d6: 'hp_percent' }
};

function toggleJsonInput() {
    const box = document.getElementById('json-box');
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function applyPreset() {
    const agentKey = document.getElementById('agent-select').value;
    const data = PRESETS[agentKey];
    document.getElementById('role-display').innerText = `特性: ${data.role}型${data.role === '鋭御' ? ' (多重会心モデル適用)' : ''}`;
    
    const container = document.getElementById('dynamic-inputs');
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

    document.getElementById('disc4-main').value = data.d4;
    document.getElementById('disc5-main').value = data.d5;
    document.getElementById('disc6-main').value = data.d6;
    calculateOptimal();
}

function calculateOptimal() {
    const agentKey = document.getElementById('agent-select').value;
    const role = PRESETS[agentKey].role;
    const buff = parseFloat(document.getElementById('buff-percent').value) || 0;

    const enemyLv = parseFloat(document.getElementById('enemy-level').value) || 60;
    const enemyRes = parseFloat(document.getElementById('enemy-res').value) || 0;
    const stunMult = parseFloat(document.getElementById('stun-mult').value) || 1.5;

    const d4 = document.getElementById('disc4-main').value;
    const d5 = document.getElementById('disc5-main').value;
    const d6 = document.getElementById('disc6-main').value;

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

    document.getElementById('total-stats').innerHTML = statsSummary;
    document.getElementById('opt-details').innerHTML = `
        <div>想定ダメージ期待値: <strong>${finalDamage.toLocaleString()}</strong></div>
        <div style="font-size: 0.85rem; color: #aaa; margin-top: 5px;">※敵Lv.${enemyLv}・耐性${enemyRes}%・ブレイク(${stunMult}倍)での公式減衰反映値です。</div>
    `;
}

// 取得したキャラデータから画面上のフォームへ値を自動挿入する処理
function populateStatsFromApi(characterList) {
    if (!characterList || characterList.length === 0) return;
    
    // 先頭のキャラ（メインキャラ）を取得
    const char = characterList[0];
    const stats = char.stats || char.fightProp || {};

    // 攻撃・防御・HP・会心などのキーを探索してフォームに設定
    const atk = stats.atk || stats.BASE_ATK || stats[1] || null;
    const def = stats.def || stats.BASE_DEF || stats[3] || null;
    const hp = stats.hp || stats.BASE_HP || stats[2] || null;
    const cr = stats.critRate || stats.CRITICAL || stats[20] || null;
    const cd = stats.critDmg || stats.CRITICAL_HURT || stats[22] || null;

    if (atk && document.getElementById('base-atk')) document.getElementById('base-atk').value = Math.round(atk);
    if (def && document.getElementById('base-def')) document.getElementById('base-def').value = Math.round(def);
    if (hp && document.getElementById('base-hp')) document.getElementById('base-hp').value = Math.round(hp);
    if (cr && document.getElementById('base-cr')) document.getElementById('base-cr').value = (cr > 1 ? cr : cr * 100).toFixed(1);
    if (cd && document.getElementById('base-cd')) document.getElementById('base-cd').value = (cd > 1 ? cd : cd * 100).toFixed(1);
}

async function fetchEnkaData() {
    const uidInput = document.getElementById('uid-input');
    const statusEl = document.getElementById('api-status');
    const uid = uidInput ? uidInput.value.trim() : '';

    if (!statusEl) return;

    statusEl.innerText = '[通信開始] Enka APIよりデータを同期中...';
    statusEl.style.color = '#ffaa00';

    try {
        const result = await ZZZApi.fetchByUid(uid);
        statusEl.innerText = `[SUCCESS] ${result.source}\n${result.logs}`;
        statusEl.style.color = '#00e676';

        // 抽出したステータスを画面に反映
        populateStatsFromApi(result.characters);
        calculateOptimal();
    } catch (err) {
        statusEl.innerText = err.message || err;
        statusEl.style.color = '#ff5555';
    }
}

function importJsonData() {
    const statusEl = document.getElementById('api-status');
    const rawInput = document.getElementById('json-input');
    const raw = rawInput ? rawInput.value.trim() : '';

    if (!statusEl) return;

    try {
        const result = ZZZApi.parseJsonString(raw);
        statusEl.innerText = `[SUCCESS] ${result.source}\n${result.logs}`;
        statusEl.style.color = '#00e676';

        populateStatsFromApi(result.characters);
        calculateOptimal();
    } catch (err) {
        statusEl.innerText = err.message || err;
        statusEl.style.color = '#ff5555';
    }
}

// 初期化
window.addEventListener('DOMContentLoaded', () => {
    applyPreset();
});