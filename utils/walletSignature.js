/**
 * Wallet signature utility for dapp authentication
 * Signs messages with the wallet's private key to prove ownership
 */

import bs58 from 'bs58';
import * as solanaWeb3 from '@solana/web3.js';
import nacl from 'tweetnacl';

/**
 * Sign a message with the wallet's private key
 * @param {string} message - The message to sign
 * @param {Uint8Array|string} privateKey - The wallet's private key (Uint8Array or base58 string)
 * @returns {string} - The signature in base58 format
 */
export function signMessage(message, privateKey) {
  try {
    const messageBytes = new TextEncoder().encode(message);

    let privateKeyBytes;
    if (typeof privateKey === 'string') {
      privateKeyBytes = bs58.decode(privateKey);
    } else if (privateKey instanceof Uint8Array) {
      privateKeyBytes = privateKey;
    } else {
      throw new Error('Invalid private key format');
    }

    const keypair = solanaWeb3.Keypair.fromSecretKey(privateKeyBytes);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

    return bs58.encode(signature);
  } catch (error) {
    console.error('[walletSignature] Failed to sign message:', error);
    throw new Error('Failed to sign message');
  }
}

/**
 * Verify a message signature
 * @param {string} message - The original message
 * @param {string} signature - The signature in base58 format
 * @param {string} publicKey - The public key in base58 format
 * @returns {boolean} - True if signature is valid
 */
export function verifyMessage(message, signature, publicKey) {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(publicKey);

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('[walletSignature] Failed to verify signature:', error);
    return false;
  }
}

/**
 * Generate a signed request payload for edge functions
 * @param {string} action - The action being performed (e.g., 'withdraw', 'airdrop')
 * @param {object} params - Additional parameters to include in the message
 * @param {Uint8Array|string} privateKey - The wallet's private key
 * @returns {object} - The signed payload including signature, timestamp, and idempotency key
 */
export function createSignedPayload(action, params = {}, privateKey) {
  const timestamp = Date.now();
  const idempotencyKey = `${action}-${timestamp}-${Math.random().toString(36).substring(2, 15)}`;

  let message;
  if (action === 'withdraw') {
    message = `withdraw:${params.amount || 0}:${timestamp}:${idempotencyKey}`;
  } else if (action === 'airdrop') {
    message = `airdrop:${timestamp}`;
  } else {
    message = `${action}:${timestamp}:${idempotencyKey}`;
  }

  const signature = signMessage(message, privateKey);

  return {
    ...params,
    signature,
    timestamp,
    idempotencyKey,
  };
}

/**
 * Call an edge function with wallet signature authentication
 * @param {string} functionUrl - The edge function URL
 * @param {string} action - The action being performed
 * @param {object} params - Parameters to send
 * @param {Uint8Array|string} privateKey - The wallet's private key
 * @returns {Promise<Response>} - The fetch response
 */
export async function callSignedEdgeFunction(functionUrl, action, params, privateKey) {
  const payload = createSignedPayload(action, params, privateKey);

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response;
}
