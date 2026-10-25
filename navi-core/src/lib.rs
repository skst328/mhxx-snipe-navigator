//! ブラウザ (TypeScript) から呼ぶ入口。乱数と護石は mhxx-rand に任せ、結果を JS のオブジェクトに変えるだけ。
//! 投入する素材のランクは最高ランク (4) に決めてある

pub mod types;

use mhxx_rand as rand;
use wasm_bindgen::prelude::*;

use types::{Charm, Compare, Found, Kind, Melding, Outcome, SkillInfo};

/// number で受けたフレームを u64 に直す (0 以上の整数でなければエラー)
fn frame(v: f64) -> Result<u64, JsError> {
    if v >= 0.0 && v.fract() == 0.0 && v <= 2f64.powi(53) {
        Ok(v as u64)
    } else {
        Err(JsError::new(&format!("フレームは 0 以上の整数: {v}")))
    }
}

/// JS の値に変える。None は undefined ではなく null にする (d.ts の `T | null` と揃える)
fn to_js<T: serde::Serialize>(v: &T) -> Result<JsValue, JsError> {
    Ok(v.serialize(&serde_wasm_bindgen::Serializer::new().serialize_missing_as_null(true))?)
}

/// 出ない護石のエラーを、画面に出す文にする。1 行目は見出し (title)、2 行目から種類ごとの理由
fn impossible_message(
    charm: &rand::Charm,
    reasons: &[(rand::Kind, rand::Reason)],
    title: &str,
) -> String {
    let s1 = charm.skill1.name();
    let lines = reasons.iter().map(|&(kind, reason)| {
        let name = match kind {
            rand::Kind::Weathered => "風化したお守り",
            rand::Kind::Worn => "古びたお守り",
            rand::Kind::Shining => "光るお守り",
            rand::Kind::Mystery => "なぞのお守り",
        };
        let (s2, p2) = charm.skill2.map_or(("", 0), |(s, p)| (s.name(), p));
        let why = match reason {
            rand::Reason::Skill1 => format!("{s1}が第1スキルにならない"),
            rand::Reason::Pts1 => format!("第1スキルに{s1}{}が出ない", charm.pts1),
            // なぞのお守りには第 2 スキルがそもそも付かない
            rand::Reason::Skill2 if kind == rand::Kind::Mystery => {
                "第2スキルが付かない".to_string()
            }
            rand::Reason::Skill2 => format!("{s2}が第2スキルにならない"),
            rand::Reason::Pts2 => format!("第2スキルに{s2}{p2}が出ない"),
            rand::Reason::SameSkill => "第1スキルと第2スキルが同じ".to_string(),
            rand::Reason::Slots => format!("スロット{}は出ない", charm.slots),
            rand::Reason::NotInMelding => "この錬金では出ない".to_string(),
        };
        format!("{name}: {why}")
    });
    std::iter::once(title.to_string())
        .chain(lines)
        .collect::<Vec<_>>()
        .join("\n")
}

/// melding で出うるスキル (番号の小さい順) と、第 1・第 2 スキルとしてのポイントの範囲
#[wasm_bindgen(js_name = skillInfo, unchecked_return_type = "SkillInfo[]")]
pub fn skill_info(
    #[wasm_bindgen(unchecked_param_type = "Melding")] melding: JsValue,
) -> Result<JsValue, JsError> {
    let melding: Melding = serde_wasm_bindgen::from_value(melding)?;
    let info: Vec<SkillInfo> = rand::skill_info(melding.into())
        .iter()
        .map(SkillInfo::from)
        .collect();
    to_js(&info)
}

/// 位置 [start, end) で、compare の比べ方で charms のどれかに合う護石が、kinds のどれかの種類のお守りとして
/// 作られる位置を探し、錬金のフレームと一緒に返す (位置の小さい順)。
/// charms と kinds の組のうち出ないものは飛ばし、どれも出なければエラー (第 1 スキルを問わないときに、
/// 呼ぶ側が第 1 スキルごとの条件を並べて渡す)。エラーの文は画面にそのまま出せる日本語で、charms が 1 つなら
/// 種類ごとの理由も改行で区切って付ける (候補が多いと長くなりすぎるので)。
/// 範囲で区切って呼べるので、進み具合の表示は呼ぶ側が範囲を刻む。
/// 返すのは位置の小さいほうから limit 件まで (条件がゆるいと何十万件も当たり、JS に渡すのが重いので)
#[wasm_bindgen(unchecked_return_type = "Found[]")]
pub fn search(
    #[wasm_bindgen(unchecked_param_type = "Melding")] melding: JsValue,
    #[wasm_bindgen(unchecked_param_type = "Charm[]")] charms: JsValue,
    #[wasm_bindgen(unchecked_param_type = "Kind[]")] kinds: JsValue,
    #[wasm_bindgen(unchecked_param_type = "Compare")] compare: JsValue,
    start: f64,
    end: f64,
    limit: u32,
) -> Result<JsValue, JsError> {
    let melding: rand::Melding = serde_wasm_bindgen::from_value::<Melding>(melding)?.into();
    let charms: Vec<Charm> = serde_wasm_bindgen::from_value(charms)?;
    let kinds: Vec<rand::Kind> = serde_wasm_bindgen::from_value::<Vec<Kind>>(kinds)?
        .into_iter()
        .map(Into::into)
        .collect();
    let compare: Compare = serde_wasm_bindgen::from_value(compare)?;
    let detail = charms.len() == 1;
    let mut queries = Vec::new();
    // 出なかった組の、種類ごとの理由 (charms が 1 つのときだけ使う)
    let mut reasons = Vec::new();
    let mut last = None;
    for charm in charms {
        let charm = rand::Charm::try_from(charm).map_err(|e| JsError::new(&e))?;
        for &kind in &kinds {
            match rand::Query::new(melding, rand::Rank::MAX, Some(kind), &charm) {
                Ok(q) => queries.push(q),
                Err(rand::QueryError::Impossible(r)) => reasons.extend(r),
            }
        }
        last = Some(charm);
    }
    if queries.is_empty() {
        let title = if kinds.len() == melding.kinds().len() {
            "この錬金では出ない組み合わせ"
        } else {
            "選んだ種類では出ない組み合わせ"
        };
        let message = match last {
            Some(charm) if detail => impossible_message(&charm, &reasons, title),
            Some(_) => title.to_string(),
            None => "探す護石がない".to_string(),
        };
        return Err(JsError::new(&message));
    }
    let found: Vec<Found> = rand::search_many(&queries, compare.into(), frame(start)?..frame(end)?)
        .iter()
        .take(limit as usize)
        .map(Found::from)
        .collect();
    to_js(&found)
}

/// フレーム [start, end) のフレームごとに、melding で錬金したときの結果 (フレームの小さい順)。
/// 狙ったフレームの前後で錬金したら何が出るかを見るのに使う
#[wasm_bindgen(unchecked_return_type = "Outcome[]")]
pub fn outcomes(
    #[wasm_bindgen(unchecked_param_type = "Melding")] melding: JsValue,
    start: f64,
    end: f64,
) -> Result<JsValue, JsError> {
    let melding: Melding = serde_wasm_bindgen::from_value(melding)?;
    let outcomes: Vec<Outcome> =
        rand::outcomes(melding.into(), rand::Rank::MAX, frame(start)?..frame(end)?)
            .iter()
            .map(Outcome::from)
            .collect();
    to_js(&outcomes)
}
