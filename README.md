# mhxx-snipe-navigator

MHXX 護石スナイプの一連の流れを補助するブラウザ向けのツール (作成中)。

## 開発

```sh
pnpm install

# 乱数の検索 (Rust → WebAssembly)
# navi-core/pkg を作る
# Rust を変えたら打ち直す
cd navi-core
wasm-pack build --target web
cd ..

pnpm dev

# テスト (src/lib の *.test.ts)
pnpm test
```

## ライセンス

MIT License です。全文は [LICENSE](LICENSE) を参照してください。

### 使用しているソフトウェア

配布物に含まれるものと、そのライセンスです。

| | ライセンス | 用途 |
|---|---|---|
| [React](https://react.dev/) | MIT | 画面 |
| [Base UI](https://base-ui.com/) | MIT | UI 部品の土台 |
| [shadcn/ui](https://ui.shadcn.com/) | MIT | UI 部品 |
| [Tailwind CSS](https://tailwindcss.com/) / tw-animate-css | MIT | スタイル |
| [class-variance-authority](https://cva.style/) | Apache-2.0 | スタイルの切り替え |
| [Lucide](https://lucide.dev/) | ISC | アイコン |
| [Geist](https://vercel.com/font) | **OFL-1.1** | フォント |
| [wasm-bindgen](https://github.com/wasm-bindgen/wasm-bindgen) / serde / [tsify](https://github.com/madonoharu/tsify) ほか | MIT または Apache-2.0 | Rust から WebAssembly への橋渡し |
| [mhxx-rand](https://github.com/skst328/mhxx-rand) | MIT | 乱数と護石の決まり方 (護石の検索) |

**Geist** は SIL Open Font License 1.1 です。ライセンス全文は
<https://github.com/vercel/geist-font> に含まれています。

**乱数と護石の決まり方** は mhxx-rand を使っています。mhxx-rand は
apmnnn 氏の [mhxx-rng](https://github.com/apmnnn/mhxx-rng) (MIT) の移植で、
mhxx-rng の MIT ライセンスの全文は mhxx-rand の `rand-core/src/rng.rs` の冒頭に
記載されています。
