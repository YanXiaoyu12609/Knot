# Knot

**Knot** 是一个现代化的学术文献管理与 AI 分析系统，帮助研究人员高效管理、阅读和分析学术论文。

![Next.js](https://img.shields.io/badge/Next.js-15.1-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 核心功能

- 📚 **文献管理**：导入、组织和分类 PDF 文献，支持多层级文集
- 📖 **内置阅读器**：无需外部工具即可阅读和预览 PDF
- 🤖 **AI 智能分析**：使用 Google Gemini AI 深度分析学术论文
- 🔗 **知识图谱**：可视化文献引用关系和作者网络
- 📝 **元数据编辑**：完整的文献信息管理（标题、作者、摘要、DOI 等）
- 🎨 **现代化 UI**：支持明暗主题，流畅的用户体验
- 💾 **本地存储**：所有数据存储在浏览器本地，完全离线可用

查看完整功能列表：[FEATURES.md](./FEATURES.md)

## 🚀 快速开始

### 前置要求

- Node.js 18.0+
- npm / yarn / pnpm / bun

### 安装

```bash
# 克隆仓库
git clone https://github.com/YanXiaoyu12609/Knot.git
cd Knot

# 安装依赖
npm install
```

### 配置

1. 复制环境变量模板文件：
```bash
cp env.example.txt .env.local
```

2. 编辑 `.env.local`，配置你的 Google Gemini API Key：
```env
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
```

> 💡 获取 API Key：访问 [Google AI Studio](https://makersuite.google.com/app/apikey)

### 运行

```bash
# 启动开发服务器
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 即可开始使用。

### 构建生产版本

```bash
# 构建
npm run build

# 启动生产服务器
npm start
```

## 📖 使用指南

### 基本工作流

1. **导入文献**：拖拽 PDF 文件到主界面
2. **组织管理**：创建文集，将文献分类整理
3. **AI 分析**：点击 ✨ 图标，让 AI 分析论文内容
4. **查看关系**：使用知识图谱探索文献引用网络
5. **导出笔记**：将 AI 分析结果导出为 Markdown

### 快捷键

- `Ctrl/Cmd + K`: 快速搜索
- `ESC`: 关闭面板
- `Delete`: 删除选中项

## 🛠️ 技术栈

- **框架**: [Next.js 15](https://nextjs.org/) (App Router)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **数据库**: [Dexie.js](https://dexie.org/) (IndexedDB)
- **UI 组件**: [Radix UI](https://www.radix-ui.com/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **PDF 处理**: [PDF.js](https://mozilla.github.io/pdf.js/)
- **AI**: [Google Gemini API](https://ai.google.dev/)
- **图谱可视化**: [react-force-graph](https://github.com/vasturiano/react-force-graph)

## 📁 项目结构

```
Knot/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 主页面
│   ├── layout.tsx         # 布局组件
│   └── actions.ts         # Server Actions
├── components/            # React 组件
│   ├── Sidebar.tsx       # 侧边栏（文集管理）
│   ├── ReferenceList.tsx # 文献列表
│   ├── DetailPanel.tsx   # 文献详情面板
│   ├── AnalysisPanel.tsx # AI 分析面板
│   ├── GraphView.tsx     # 知识图谱
│   └── PdfViewer.tsx     # PDF 阅读器
├── lib/                   # 工具库
│   ├── db.ts             # 数据库定义
│   ├── gemini.ts         # AI 分析接口
│   ├── referenceParser.ts # 参考文献解析
│   └── graphUtils.ts     # 图谱工具
└── public/               # 静态资源
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 开源协议

本项目采用 [MIT](LICENSE) 协议开源。

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [Google Gemini](https://ai.google.dev/) - AI 分析能力
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF 渲染支持
