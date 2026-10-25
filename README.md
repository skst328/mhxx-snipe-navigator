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
```

## ライセンス

MIT License です。全文は [LICENSE](LICENSE) を参照してください。
