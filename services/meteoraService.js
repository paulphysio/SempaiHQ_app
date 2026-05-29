/**
 * Meteora DEX Integration Service
 * Provides advanced DEX functionality for token swapping on Solana
 */

const API_BASE_URL = 'https://sempaihq.com/api';

/**
 * Get Meteora pool information
 */
export const getMeteoraPool = async (poolAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/meteora/pool/${poolAddress}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MeteoraService] Error getting pool:', error);
    throw error;
  }
};

/**
 * Get swap quote from Meteora
 */
export const getMeteoraQuote = async (inputMint, outputMint, amount, slippageBps = 100) => {
  try {
    const response = await fetch(`${API_BASE_URL}/meteora/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputMint,
        outputMint,
        amount,
        slippageBps
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MeteoraService] Error getting quote:', error);
    throw error;
  }
};

/**
 * Execute swap on Meteora
 */
export const executeMeteoraSwap = async (walletAddress, quote, userPublicKey) => {
  try {
    const response = await fetch(`${API_BASE_URL}/meteora/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        quote,
        userPublicKey
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[MeteoraService] Swap executed:', data.signature);
    return data;
  } catch (error) {
    console.error('[MeteoraService] Error executing swap:', error);
    throw error;
  }
};

/**
 * Get all Meteora pools for a token pair
 */
export const getMeteoraPools = async (tokenA, tokenB) => {
  try {
    const response = await fetch(`${API_BASE_URL}/meteora/pairs/${tokenA}/${tokenB}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MeteoraService] Error getting pools:', error);
    throw error;
  }
};

/**
 * Get best route for swap
 */
export const getBestRoute = async (inputMint, outputMint, amount, slippageBps = 100) => {
  try {
    const response = await fetch(`${API_BASE_URL}/meteora/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputMint,
        outputMint,
        amount,
        slippageBps
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MeteoraService] Error getting best route:', error);
    throw error;
  }
};

/**
 * Get pool liquidity
 */
export const getPoolLiquidity = async (poolAddress) => {
  try {
    const response = await fetch(`${API_BASE_URL}/meteora/liquidity/${poolAddress}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[MeteoraService] Error getting liquidity:', error);
    throw error;
  }
};

/**
 * Add liquidity to pool
 */
export const addLiquidity = async (walletAddress, poolAddress, tokenAAmount, tokenBAmount, userPublicKey) => {
  try {
    const response = await fetch(`${API_BASE_URL}/meteora/add-liquidity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        poolAddress,
        tokenAAmount,
        tokenBAmount,
        userPublicKey
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[MeteoraService] Liquidity added:', data.signature);
    return data;
  } catch (error) {
    console.error('[MeteoraService] Error adding liquidity:', error);
    throw error;
  }
};

/**
 * Remove liquidity from pool
 */
export const removeLiquidity = async (walletAddress, poolAddress, lpTokenAmount, userPublicKey) => {
  try {
    const response = await fetch(`${API_BASE_URL}/meteora/remove-liquidity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        poolAddress,
        lpTokenAmount,
        userPublicKey
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[MeteoraService] Liquidity removed:', data.signature);
    return data;
  } catch (error) {
    console.error('[MeteoraService] Error removing liquidity:', error);
    throw error;
  }
};

export default {
  getMeteoraPool,
  getMeteoraQuote,
  executeMeteoraSwap,
  getMeteoraPools,
  getBestRoute,
  getPoolLiquidity,
  addLiquidity,
  removeLiquidity
};
