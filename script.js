/**
 * ゼンゼロ ビルド＆PTバフ与ダメ比較計算制御
 */

// スプレッドシート表からPTバフの合計数値を収集する関数
function getTableBuffTotals() {
    let totals = { atkP: 0, atkF: 0, dmgP: 0, cr: 0, cd: 0, ap: 0, pen: 0 };
    const rows = document.querySelectorAll('#buff-table-body tr');

    rows.forEach(row => {
        const enabled = row.querySelector('.buff-enable')?.checked;
        if (!enabled) return;

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
 * メインの計算処理：現在のビルド ＋ PTバフ ＋ ステータス増減を考慮した与ダメシミュレーション
 */
function calculateOptimal() {
    const activeChar = fetchedCharacters[0] || null;
    const ptBuffs = getTableBuffTotals();

    // 微調整（増減）値を取得
    const adjAtkP = parseFloat(document.getElementById('adj-atk-p')?.value || 0);
    const adjCr   = parseFloat(document.getElementById('adj-cr')?.value || 0);
    const adjCd   = parseFloat(document.getElementById('adj-cd')?.value || 0);
    const adjAp   = parseFloat(document.getElementById('adj-ap')?.value || 0);

    // 基礎攻撃力基準値（Lv60想定）
    const baseAtk = 1521; 

    // ① ベース（PTバフのみ適用時）
    const baseFinalAtk = baseAtk * (1 + ptBuffs.atkP / 100) + ptBuffs.atkF;
    const baseCr = Math.min(100, 14.6 + ptBuffs.cr);
    const baseCd = 50 + ptBuffs.cd;
    const baseAp = 248 + ptBuffs.ap;
    const baseCritMult = 1 + (baseCr / 100) * (baseCd / 100);

    const baseDmgExpect = Math.round(baseFinalAtk * baseCritMult * (1 + (baseAp / 100)) * (1 + ptBuffs.dmgP / 100));

    // ② シミュレーション（ステータス増減適用後）
    const simFinalAtk = baseAtk * (1 + (ptBuffs.atkP + adjAtkP) / 100) + ptBuffs.atkF;
    const simCr = Math.min(100, 14.6 + ptBuffs.cr + adjCr);
    const simCd = 50 + ptBuffs.cd + adjCd;
    const simAp = 248 + ptBuffs.ap + adjAp;
    const simCritMult = 1 + (simCr / 100) * (simCd / 100);

    const simDmgExpect = Math.round(simFinalAtk * simCritMult * (1 + (simAp / 100)) * (1 + ptBuffs.dmgP / 100));

    // 変化割合 (%)
    const diffDmg = simDmgExpect - baseDmgExpect;
    const diffPercent = baseDmgExpect > 0 ? ((diffDmg / baseDmgExpect) * 100).toFixed(2) : '0.00';

    // 結果表示
    const simBox = document.getElementById('sim-comparison');
    if (simBox) {
        simBox.innerHTML = `
            <div style="font-size: 0.95rem; margin-bottom: 6px;">
                PTバフ適用時 与ダメ期待値: <strong style="color: #00e676;">${baseDmgExpect.toLocaleString()}</strong>
            </div>
            <div style="font-size: 1.1rem; font-weight: bold; color: ${diffDmg >= 0 ? '#ffaa00' : '#ff5555'};">
                調整後 与ダメ期待値: ${simDmgExpect.toLocaleString()} 
                <span style="font-size: 0.9rem;">(${diffDmg >= 0 ? '+' : ''}${diffDmg.toLocaleString()} / ${diffDmg >= 0 ? '+' : ''}${diffPercent}%)</span>
            </div>
            <div style="font-size: 0.78rem; color: #888; margin-top: 8px;">
                ※表で設定したPTバフ（攻撃力%+${ptBuffs.atkP}%, 与ダメ+${ptBuffs.dmgP}%等）と手動の増減数値をリアルタイム合成しています。
            </div>
        `;
    }
}