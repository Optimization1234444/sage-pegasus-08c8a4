import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 初始化 Express 应用
const app = express();
const PORT = process.env.PORT || 3000;

// 获取当前文件目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 中间件：解析 JSON 请求体
app.use(express.json());

// 2. 静态文件托管 (关键修改)
// 假设你的前端构建产物在 'dist' 或 'public' 目录，或者直接托管根目录下的静态文件
// 如果你没有构建步骤，且 index.html 在项目根目录，可以使用:
const staticDir = path.join(__dirname, 'dist'); // 如果有构建产物
// 如果文件直接在根目录，改为: const staticDir = __dirname;

if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  console.log(`✅ Serving static files from: ${staticDir}`);
} else {
  console.warn('⚠️ Static directory not found, skipping static serving.');
}

// 3. 健康检查路由 (K8s 探针需要)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 4. 根路径回退 (SPA 支持)
// 如果访问 / 且没有匹配到静态文件，返回 index.html (如果是单页应用)
app.get('/', (req, res) => {
  // 尝试发送 index.html
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // 如果没有 dist/index.html，则返回简单文本
    res.send('服务部署成功！欢迎访问 yanxi99999 应用 (无前端静态文件)');
  }
});

// 5. 动态加载 Netlify Functions
const functionsDir = path.join(__dirname, 'netlify', 'functions');

if (fs.existsSync(functionsDir)) {
  const files = fs.readdirSync(functionsDir).filter(file => file.endsWith('.js'));

  files.forEach(file => {
    const functionName = file.replace('.js', '');
    const routePath = `/.netlify/functions/${functionName}`;
    
    // 动态导入
    import(path.join(functionsDir, file)).then(module => {
      const handler = module.handler || module.default;
      
      if (handler) {
        app.all(routePath, async (req, res) => {
          try {
            const event = {
              httpMethod: req.method,
              path: req.path,
              queryStringParameters: req.query,
              body: req.body,
              headers: req.headers,
            };

            const result = await handler(event, {});
            
            res.status(result.statusCode || 200);
            if (result.headers) {
              Object.entries(result.headers).forEach(([key, value]) => {
                res.setHeader(key, value);
              });
            }
            res.send(result.body);
          } catch (error) {
            console.error(`Error in function ${functionName}:`, error);
            res.status(500).json({ error: 'Internal Server Error' });
          }
        });
        console.log(`✅ Registered function: ${routePath}`);
      } else {
        console.warn(`⚠️ No handler found in ${file}`);
      }
    }).catch(err => {
      console.error(`❌ Failed to load function ${file}:`, err);
    });
  });
} else {
  console.warn('⚠️ Functions directory not found:', functionsDir);
}

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
