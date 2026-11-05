import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const functionsDir = path.join(__dirname, 'netlify', 'functions');

// 读取 functions 目录下的所有 js 文件
if (fs.existsSync(functionsDir)) {
  const files = fs.readdirSync(functionsDir).filter(file => file.endsWith('.js'));

  files.forEach(file => {
    const functionName = file.replace('.js', '');
    const routePath = `/.netlify/functions/${functionName}`;
    
    // 动态导入函数
    import(path.join(functionsDir, file)).then(module => {
      const handler = module.handler || module.default;
      
      if (handler) {
        app.all(routePath, async (req, res) => {
          try {
            // 构造 Netlify 风格的事件对象
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
        console.log(`Registered function: ${routePath}`);
      } else {
        console.warn(`No handler found in ${file}`);
      }
    }).catch(err => {
      console.error(`Failed to load function ${file}:`, err);
    });
  });
} else {
  console.warn('Functions directory not found:', functionsDir);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
import express from 'express';
import serverless from 'serverless-http';
import { handler as myFunctionHandler } from './netlify/functions/your-function-name.js'; // 替换为你的实际函数路径和导出名

const app = express();

// 将 Netlify 函数包装为 Express 中间件
// 注意：serverless-http 通常用于 AWS Lambda，对于 Netlify Functions 可能需要适配
// 更简单的做法是直接导入函数逻辑并在 Express 路由中调用

app.get('/.netlify/functions/your-function-name', async (req, res) => {
  try {
    // 模拟 Netlify 的事件对象
    const event = {
      httpMethod: req.method,
      path: req.path,
      queryStringParameters: req.query,
      body: req.body,
      headers: req.headers
    };
    
    // 调用你的函数
    const result = await myFunctionHandler(event, {});
    
    res.status(result.statusCode || 200).json(result.body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
