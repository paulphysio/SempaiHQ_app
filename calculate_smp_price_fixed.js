const poolAddress = "3duTFdX9wrGh3TatuKtorzChL697HpiufZDPnc44Yp33";
const meteoraApiUrl = `https://amm-v2.meteora.ag/pools?address=${poolAddress}`;

const usdcAmount = 0.025;

async function fetchPoolData() {
    try {
        const response = await fetch(meteoraApiUrl).then((r) => r.json());
        const poolData = response[0];
        return poolData;
    } catch (error) {
        throw new Error(`Failed to fetch pool data: ${error.message}`);
    }
}

function calculateSmpPerSol(pool) {
    const smpAmount = parseFloat(pool.pool_token_amounts[0]);
    const solAmount = parseFloat(pool.pool_token_amounts[1]);

    if (smpAmount <= 0 || solAmount <= 0) {
        throw new Error("Invalid pool amounts: SMP and SOL amounts must be positive");
    }

    const smpPerSol = smpAmount / solAmount;
    return smpPerSol;
}

async function convertUsdcToSmp(usdcAmount) {
    try {
        const poolData = await fetchPoolData();
        console.log("Fetched Pool Data:", poolData);

        // Calculate SMP per SOL from pool ratios
        const smpPerSol = calculateSmpPerSol(poolData);
        console.log(`SMP per SOL: ${smpPerSol.toFixed(2)} SMP`);

        // Use fallback SOL price (since API returns 0 for USD values)
        const fallbackSolPrice = 100; // $100 per SOL
        console.log(`Using fallback SOL price: $${fallbackSolPrice} USD`);

        // Convert USDC to SOL
        const solAmount = usdcAmount / fallbackSolPrice;
        console.log(`${usdcAmount} USDC = ${solAmount.toFixed(8)} SOL`);

        // Convert SOL to SMP
        const smpAmount = solAmount * smpPerSol;
        console.log(`${solAmount.toFixed(8)} SOL = ${smpAmount.toFixed(2)} SMP`);

        return smpAmount;
    } catch (error) {
        console.error("Error:", error.message);
        return null;
    }
}

async function main() {
    console.log(`Converting ${usdcAmount} USDC to SMP...`);
    const smpAmount = await convertUsdcToSmp(usdcAmount);
    if (smpAmount !== null) {
        console.log(`\nFinal Result: ${usdcAmount} USDC = ${smpAmount.toFixed(2)} SMP`);
    }
}

main();
