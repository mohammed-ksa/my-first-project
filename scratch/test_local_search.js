const http = require('http');

const data = JSON.stringify({
  q: 'إيمان عمر',
  pointId: 'nuseirat'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/searchLocal',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.time('LocalSearchSpeed');
const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.timeEnd('LocalSearchSpeed');
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(body);
    console.log('Success:', parsed.success);
    console.log('Results count:', parsed.results ? parsed.results.length : 0);
    if (parsed.results && parsed.results.length > 0) {
      console.log('First matched visit:', {
        id: parsed.results[0].id,
        idNumber: parsed.results[0].idNumber,
        fullName: parsed.results[0].fullName,
        phone: parsed.results[0].phone,
        visitDate: parsed.results[0].visitDate
      });
    }
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
