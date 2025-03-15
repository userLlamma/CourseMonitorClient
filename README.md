# 课程 API 测试报告工具

这个工具用于自动测试学生实现的 API 功能并向教师服务器报告结果。它支持远程命令执行、测试模块管理和定期自动报告。

## 功能特点

- 自动测试 API 实现，包括基础 CRUD 操作和高级查询功能
- 自动收集系统和硬件信息
- 支持通过密钥对安全认证
- 支持远程命令执行
- 支持教师远程启用/禁用测试模块
- 定期自动报告
- 易于扩展的测试框架，可随课程进度添加新的测试模块

## 安装

### 前提条件

- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装步骤

1. 克隆仓库：

```bash
git clone https://github.com/yourusername/course-reporter.git
cd course-reporter
```

2. 安装依赖：

```bash
npm install
```

3. 设置全局命令：

```bash
npm link
```

## 使用方法

### 初始配置

首次使用时，需要进行配置：

```bash
course-reporter setup
```

这将引导你设置学号、姓名和 API 服务器地址，并自动生成用于安全认证的密钥对。

### 单次报告

手动执行一次 API 测试并发送报告：

```bash
course-reporter report
```

### 自动定期报告

启动自动定期报告服务：

```bash
course-reporter auto
```

可以指定报告间隔时间（分钟）：

```bash
course-reporter auto -i 10
```

### 仅执行测试

仅执行 API 测试，不发送报告：

```bash
course-reporter test
```

### 查看测试模块状态

查看当前可用的测试模块及其激活状态：

```bash
course-reporter modules
```

### 查看配置状态

查看当前配置信息和密钥状态：

```bash
course-reporter status
```

## 系统架构

该工具采用模块化设计，主要组件包括：

- **配置管理器**：负责读取和保存配置
- **报告核心**：负责数据收集和报告发送
- **测试框架**：提供可扩展的 API 测试功能
- **命令处理器**：处理服务器发送的命令
- **测试模块管理器**：管理测试模块的激活状态

## 安全特性

- 使用 RSA 密钥对进行安全认证
- 私钥本地保存，受权限保护
- 支持硬件指纹采集，用于身份验证
- 可远程重置密钥对

## 开发指南

### 添加新的测试模块

1. 在 `src/api/student-api.js` 中的 `TestModules` 对象中添加新模块：

```javascript
newModule: {
  name: "新模块名称",
  description: "模块描述",
  active: false,
  tests: [
    {
      name: "测试名称",
      run: async () => {
        // 测试实现...
      }
    }
  ]
}
```

2. 更新 `src/core/test-module-manager.js` 中的 `DEFAULT_MODULES` 对象。

### 自定义硬件信息收集

编辑 `src/utils/hardware-info.js` 文件，修改或添加要收集的硬件信息项。

## 许可证

MIT