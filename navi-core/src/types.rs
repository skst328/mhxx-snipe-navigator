//! TS とやり取りするデータ型。serde でシリアライズし、tsify が .d.ts を生成する。
//! フレームは 2^32 を超えうるので number (f64) で渡す (2^53 までは正確)。
//! Option は null で渡す (lib.rs の to_js)

use mhxx_rand as rand;
use serde::{Deserialize, Serialize};
use tsify::Tsify;

/// mhxx-rng のスキル番号
#[tsify::declare]
pub type SkillId = u16;

/// 錬金のやり方
#[derive(Tsify, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Melding {
    /// マカフシギ錬金 (風化・古びた)
    Juju,
    /// 天運の錬金 (古びた・光る・なぞ)
    Halcyon,
}

impl From<Melding> for rand::Melding {
    fn from(m: Melding) -> Self {
        match m {
            Melding::Juju => Self::Juju,
            Melding::Halcyon => Self::Halcyon,
        }
    }
}

/// 見つけた護石と、探す護石の比べ方
#[derive(Tsify, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Compare {
    /// 中身が同じ
    Exact,
    /// スキルが同じで、ポイントとスロットが以上 (第 2 スキルが無ければ、第 2 スキルは問わない)
    AtLeast,
}

impl From<Compare> for rand::Compare {
    fn from(c: Compare) -> Self {
        match c {
            Compare::Exact => Self::Exact,
            Compare::AtLeast => Self::AtLeast,
        }
    }
}

/// お守りの種類 (鑑定する前のお守り)
#[derive(Tsify, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Weathered,
    Worn,
    Shining,
    Mystery,
}

impl From<Kind> for rand::Kind {
    fn from(k: Kind) -> Self {
        match k {
            Kind::Weathered => Self::Weathered,
            Kind::Worn => Self::Worn,
            Kind::Shining => Self::Shining,
            Kind::Mystery => Self::Mystery,
        }
    }
}

impl From<rand::Kind> for Kind {
    fn from(k: rand::Kind) -> Self {
        match k {
            rand::Kind::Weathered => Self::Weathered,
            rand::Kind::Worn => Self::Worn,
            rand::Kind::Shining => Self::Shining,
            rand::Kind::Mystery => Self::Mystery,
        }
    }
}

/// 鑑定画面に出る護石の中身。skill2 と pts2 は両方 null で第 2 スキルなし
#[derive(Tsify, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[tsify(missing_as_null)]
#[serde(rename_all = "camelCase")]
pub struct Charm {
    pub skill1: SkillId,
    pub pts1: i8,
    pub skill2: Option<SkillId>,
    pub pts2: Option<i8>,
    /// 0〜3
    pub slots: u8,
}

impl From<rand::Charm> for Charm {
    fn from(c: rand::Charm) -> Self {
        Self {
            skill1: c.skill1.id(),
            pts1: c.pts1,
            skill2: c.skill2.map(|(s, _)| s.id()),
            pts2: c.skill2.map(|(_, p)| p),
            slots: c.slots,
        }
    }
}

impl TryFrom<Charm> for rand::Charm {
    type Error = String;

    fn try_from(c: Charm) -> Result<Self, String> {
        let skill = |id| rand::Skill::from_id(id).ok_or(format!("護石に付かないスキル番号: {id}"));
        let skill2 = match (c.skill2, c.pts2) {
            (Some(s), Some(p)) => Some((skill(s)?, p)),
            (None, None) => None,
            _ => return Err("skill2 と pts2 は両方渡すか、両方 null にする".into()),
        };
        Ok(Self {
            skill1: skill(c.skill1)?,
            pts1: c.pts1,
            skill2,
            slots: c.slots,
        })
    }
}

/// 錬金で出うるスキルと、ポイントの範囲 (画面の選択肢に使う)。そのスキルになれない欄は null
#[derive(Tsify, Serialize, Clone, Debug, PartialEq, Eq)]
#[tsify(missing_as_null)]
pub struct SkillInfo {
    pub id: SkillId,
    /// 正式名称 (鑑定画面の表記)
    pub name: &'static str,
    /// 本家の日本語の略称 (選ぶときに略称でも引けるように)
    pub abbr: &'static str,
    /// 第 1 スキルとしてのポイントの範囲
    pub pts1: Option<PointRange>,
    /// 第 2 スキルとしてのポイントの範囲 (錬金ではマイナスは出ないので 1 から)
    pub pts2: Option<PointRange>,
}

/// ポイントの範囲 (両端を含む)
#[derive(Tsify, Serialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct PointRange {
    pub min: i8,
    pub max: i8,
}

impl From<&rand::SkillInfo> for SkillInfo {
    fn from(i: &rand::SkillInfo) -> Self {
        let range = |r: &Option<std::ops::RangeInclusive<i8>>| {
            r.as_ref().map(|r| PointRange {
                min: *r.start(),
                max: *r.end(),
            })
        };
        Self {
            id: i.skill.id(),
            name: i.skill.full_name(),
            abbr: i.skill.name(),
            pts1: range(&i.pts1),
            pts2: range(&i.pts2),
        }
    }
}

/// 錬金のフレームと、その護石が何個目か
#[derive(Tsify, Serialize, Clone, Copy, Debug, PartialEq)]
pub struct Aimpoint {
    /// 錬金したフレーム
    pub start: f64,
    /// 何個目か (1 から)
    pub index: u8,
}

/// 検索で見つけた 1 件
#[derive(Tsify, Serialize, Clone, Debug, PartialEq)]
pub struct Found {
    /// その護石を作る乱数の始まり
    pub position: f64,
    /// どの種類として見つかったか
    pub kind: Kind,
    /// 鑑定画面に出る中身 (探したものよりポイントやスロットが大きいことがある)
    pub charm: Charm,
    /// この位置に届く錬金のフレームと何個目か (start の小さい順)。
    /// 見つけた位置より最大 18 (天運の錬金は 30) 手前になる
    pub aimpoints: Vec<Aimpoint>,
}

impl From<&rand::Found> for Found {
    fn from(f: &rand::Found) -> Self {
        Self {
            position: f.position as f64,
            kind: f.kind.into(),
            charm: f.charm().into(),
            aimpoints: f
                .aimpoints()
                .iter()
                .map(|a| Aimpoint {
                    start: a.start as f64,
                    index: a.index,
                })
                .collect(),
        }
    }
}

/// 錬金で出た護石 1 個 (鑑定前のお守りの種類と、鑑定後の中身)
#[derive(Tsify, Serialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct MeldedCharm {
    pub kind: Kind,
    pub charm: Charm,
}

/// 1 回の錬金の結果
#[derive(Tsify, Serialize, Clone, Debug, PartialEq)]
pub struct Outcome {
    /// 錬金したフレーム
    pub frame: f64,
    /// 出た護石 (鑑定ボックスの並び順)
    pub charms: Vec<MeldedCharm>,
}

impl From<&rand::Outcome> for Outcome {
    fn from(o: &rand::Outcome) -> Self {
        Self {
            frame: o.frame as f64,
            charms: o
                .charms
                .iter()
                .map(|&(k, c)| MeldedCharm {
                    kind: k.into(),
                    charm: c.into(),
                })
                .collect(),
        }
    }
}
