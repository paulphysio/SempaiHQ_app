const poolAddress = "3duTFdX9wrGh3TatuKtorzChL697HpiufZDPnc44Yp33";
const meteoraApiUrl = `https://amm-v2.meteora.ag/pools?address=${poolAddress}`;

async function fetchPoolData() {
    try {
        const response = await fetch(meteoraApiUrl).then((r) => r.json());
        const poolData = response[0]; // Assuming the API returns an array with the pool object
        return poolData;
    } catch (error) {
        throw new Error(`Failed to fetch pool data: ${error.message}`);
    }
}

function calculateSmpPriceInSol(pool) {
	
    const smpAmount = parseFloat(pool.pool_token_amounts[0]);
    const solAmount = parseFloat(pool.pool_token_amounts[1]);

    if (smpAmount <= 0 || solAmount <= 0) {
        throw new Error("Invalid pool amounts: SMP and SOL amounts must be positive");
    }

    if (solAmount < 0.01) {
        console.warn("Warning: Low SOL liquidity in pool. Price may be unreliable.");
    }

    const smpPerSol = smpAmount / solAmount;
    const priceInSol = solAmount / smpAmount;

    return {
        priceInSol,
        smpPerSol,
        source: "pool data"
    };
}

async function main() {
    // Fetch pool data from Meteora API
	const poolData = await fetchPoolData();
	console.log("Fetched Pool Data:", poolData);

	// Calculate SMP price
	const poolResult = calculateSmpPriceInSol(poolData);
	console.log("From Pool Data:");
	console.log(`SMP Price: ${poolResult.priceInSol.toExponential(6)} SOL per SMP`);
	console.log(`SMP per SOL: ${poolResult.smpPerSol.toFixed(2)} SMP per SOL`);

	// Reference market rate for comparison (optional)
	const marketSmpPerSol = 328861621.646602;
	console.log("Reference Market Rate:");
	console.log(`SMP Price: ${(1 / marketSmpPerSol).toExponential(6)} SOL per SMP`);
	console.log(`SMP per SOL: ${marketSmpPerSol.toFixed(2)} SMP per SOL`);
}

main();
