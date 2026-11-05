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
