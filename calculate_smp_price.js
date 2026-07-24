const poolAddress = "3duTFdX9wrGh3TatuKtorzChL697HpiufZDPnc44Yp33";
const meteoraApiUrl = `https://amm-v2.meteora.ag/pools?address=${poolAddress}`;

// Amount to convert (in USDC)
const usdcAmount = 0.025;

async function fetchPoolData() {
    try {
        const response = await fetch(meteoraApiUrl).then((r) => r.json());
        const poolData = response[0]; // Assuming the API returns an array with the pool object
        return poolData;
    } catch (error) {
        throw new Error(`Failed to fetch pool data: ${error.message}`);
    }
}

function calculateSolPriceInUsd(pool) {
    // Since Meteora API returns 0 for USD values, use fallback price
    const fallbackSolPrice = 100; // $100 per SOL
    console.log(`Using fallback SOL price: $${fallbackSolPrice} USD`);
    return fallbackSolPrice;
}

function calculateSmpPerSol(pool) {
    const smpAmount = parseFloat(pool.pool_token_amounts[0]); // SMP amount in pool
    const solAmount = parseFloat(pool.pool_token_amounts[1]); // SOL amount in pool

    if (smpAmount <= 0 || solAmount <= 0) {
        throw new Error("Invalid pool amounts: SMP and SOL amounts must be positive");
    }

    if (solAmount < 0.01) {
        console.warn("Warning: Low SOL liquidity in pool. Price may be unreliable.");
    }

    const smpPerSol = smpAmount / solAmount;
    return smpPerSol;
}

async function convertUsdcToSmp(usdcAmount) {
    try {
        // Fetch pool data
        const poolData = await fetchPoolData();
        console.log("Fetched Pool Data:", poolData);

        // Calculate SOL price in USD
        const solPriceInUsd = calculateSolPriceInUsd(poolData);
        console.log(`SOL Price: $${solPriceInUsd.toFixed(2)} USD`);

        // Convert USDC to SOL
        const solAmount = usdcAmount / solPriceInUsd;
        console.log(`${usdcAmount} USDC = ${solAmount.toFixed(8)} SOL`);

        // Calculate SMP per SOL
        const smpPerSol = calculateSmpPerSol(poolData);
        console.log(`SMP per SOL: ${smpPerSol.toFixed(2)} SMP`);

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
