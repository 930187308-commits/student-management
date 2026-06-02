# AI 配置模板

真实 AI 密钥不要写入 GitHub，也不要放在项目目录。

Mac mini 正式服务默认读取：

```text
/Users/bzx/Data/student-ai-console/ai.env
```

## 默认关闭

不创建 `ai.env` 或保持下面配置时，系统只使用本地模板：

```text
AI_PROVIDER=disabled
AI_API_KEY=
AI_MODEL=
AI_BASE_URL=
AI_TIMEOUT_MS=60000
AI_LOG_FULL_INPUT=0
```

## DeepSeek 示例

```text
AI_PROVIDER=deepseek
AI_API_KEY=你的真实密钥
AI_MODEL=deepseek-chat
AI_BASE_URL=https://api.deepseek.com/v1
AI_TIMEOUT_MS=60000
AI_LOG_FULL_INPUT=0
```

## OpenAI 示例

```text
AI_PROVIDER=openai
AI_API_KEY=你的真实密钥
AI_MODEL=gpt-4.1-mini
AI_BASE_URL=https://api.openai.com/v1
AI_TIMEOUT_MS=60000
AI_LOG_FULL_INPUT=0
```

## MiniMax 示例

国际区：

```text
AI_PROVIDER=minimax
AI_API_KEY=你的真实密钥
AI_MODEL=MiniMax-M2.7-highspeed
AI_BASE_URL=https://api.minimax.io/v1
AI_TIMEOUT_MS=60000
AI_LOG_FULL_INPUT=0
```

中国区：

```text
AI_PROVIDER=minimax
AI_API_KEY=你的真实密钥
AI_MODEL=MiniMax-M2.7-highspeed
AI_BASE_URL=https://api.minimaxi.com/v1
AI_TIMEOUT_MS=30000
AI_LOG_FULL_INPUT=0
```

## 自定义 OpenAI-compatible 接口

```text
AI_PROVIDER=custom
AI_API_KEY=你的真实密钥
AI_MODEL=模型名称
AI_BASE_URL=https://你的接口地址/v1
AI_TIMEOUT_MS=30000
AI_LOG_FULL_INPUT=0
```

## 启用步骤

1. 在 Mac mini 上创建 `/Users/bzx/Data/student-ai-console/ai.env`。
2. 填入对应供应商配置。
3. 重启服务：

```bash
launchctl kickstart -k gui/$(id -u)/com.bzx.student-ai-console
```

4. 检查状态：

```bash
./scripts/status-server.sh
npm run ai:runtime-check
```

## 安全原则

- `AI_API_KEY` 只放在 Mac mini 数据目录。
- 不提交真实密钥。
- `AI_LOG_FULL_INPUT=0` 保持默认，不保存完整隐私输入。
- 真实 AI 启用后，仍然只生成文本，不自动修改业务数据。
