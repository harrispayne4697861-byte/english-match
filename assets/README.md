# assets · 素材说明

## 现有（手绘内联 SVG，可直接用）

| 文件 | 用途 |
|---|---|
| `bg-app.svg` | 全局背景（引导页/设置页） |
| `art-kindergarten.svg` / `art-primary.svg` / `art-junior.svg` | 引导页三张年龄段插画 |
| `art-settle.svg` | 结算面板顶部奖杯 |

## 待补（AI 生成位图，放这里就会被 CSS 引用）

| 文件名 | 尺寸 | 用途 |
|---|---|---|
| `art/vine.png` | 512×2048 透明 | 藤蔓主干 |
| `art/sky-0.png` ~ `art/sky-3.png` | 780×1688 | 地面 / 林间 / 云层 / 云端之上 |
| `art/fruit-green.png` / `art/fruit-gold.png` / `art/bud.png` | 256×256 透明 | 青果 / 金果 / 花苞 |

提示词见 `docs/13-藤蔓地图改造.md` 第 4 节。替换时只改 `css/theme.css` 里对应的背景或描边，不动 JS。
