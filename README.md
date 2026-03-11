# 版本管理工作台

基于 `Vite + React + TypeScript + Zustand + TailwindCSS` 的工程化版本管理原型。

## 启动

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 目录

```text
src/
  app/
  components/
    common/
    diff/
    issue/
    overview/
    requirement/
    risk/
    sync/
    timeline/
    version/
  domain/
    models/
    services/
      compute/
      normalize/
      sync/
  seed/
  store/
  styles/
```

## 保留能力

- 双接口同步
- 单接口同步
- 华为问题单 POST 同步
- Excel / CSV 导入
- 版本总览 / 版本筛选 / 版本详情
- 风险提示
- 版本健康度
- 上线准入检查
- diff 对比
- 需求表 / 问题单表 / 时间轴分页
- localStorage 持久化

## 分层说明

- `domain/services/normalize`：字段兼容、富文本解析、版本解析、华为问题单映射
- `domain/services/compute`：风险识别、版本聚合、健康度、准入规则、diff
- `store/useProjectStore.ts`：集中状态、同步动作、持久化和 selector 入口
- `components/`：纯展示组件，尽量不承载复杂业务逻辑
