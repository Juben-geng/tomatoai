/**
 * Health Check API
 */

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    flyai: 'available',
    tuniu: 'available',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}