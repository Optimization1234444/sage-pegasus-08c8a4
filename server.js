import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 初始化 Express 应用
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('服务部署成功！欢迎访问 yanxi99999 应用');
});

// 获取当前文件目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 中间件：解析 JSON 请求体
app.use(express.json());

// 动态加载 Netlify Functions
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
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
