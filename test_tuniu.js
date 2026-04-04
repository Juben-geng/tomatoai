const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 设置环境变量
process.env.TUNIU_API_KEY = 'sk-287d9cbde8184f59a9bc957c85520ee3';

// 参数
const args = {
  cityName: '三亚',
  checkIn: '2026-04-10',
  checkOut: '2026-04-12'
};

// 写入临时文件
const argsFile = path.join(__dirname, 'tuniu_args.json');
fs.writeFileSync(argsFile, JSON.stringify(args, null, 2), 'utf8');
console.log('Args saved to:', argsFile);
console.log('Args:', JSON.stringify(args, null, 2));
console.log();

// 读取并转义
const argsJson = fs.readFileSync(argsFile, 'utf8');
console.log('Args JSON:', argsJson);
console.log();

// 调用途牛CLI
try {
  const cmd = `tuniu call hotel tuniu_hotel_search --args "${argsJson.replace(/"/g, '\\"').replace(/\n/g, '')}"`;
  console.log('Command:', cmd);
  console.log();
  
  const result = execSync(cmd, { 
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 1024 * 1024 * 10
  });
  console.log('Result:');
  console.log(result);
} catch (e) {
  console.error('Error:', e.message);
  if (e.stdout) console.log('STDOUT:', e.stdout);
  if (e.stderr) console.log('STDERR:', e.stderr);
}
