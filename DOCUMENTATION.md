# Usage Documentation

## Installation

The library can be installed via pnpm, npm, or yarn:

```bash
pnpm install @nillion/nilauth-client
```

```typescript
import { NilauthClient } from "@nillion/nilauth-client";
```

## Overview

The `@nillion/nilauth-client` package provides a TypeScript client for interacting with Nillion's authentication service (Nilauth). It handles:

- **Token Management**: Request, validate, and revoke NUC tokens
- **Subscription Management**: Check subscription status and costs
- **Payment Validation**: Validate on-chain payments for subscriptions
- **Health Checks**: Monitor service availability

## Creating a Client

The recommended way to create a client is using the static `create` method, which automatically fetches the service's public key:

```typescript
import { NilauthClient } from "@nillion/nilauth-client";

const client = await NilauthClient.create({
  baseUrl: "https://nilauth.example.com",
  chainId: 1, // Ethereum mainnet
});

// Access service information
console.log("Nilauth Public Key:", client.nilauthPublicKey);
console.log("Nilauth DID:", client.nilauthDid);
```

## Subscription Flow

### 1. Check Subscription Cost

```typescript
const cost = await client.subscriptionCost("nildb");
console.log("Subscription cost:", cost);
```

### 2. Check Subscription Status

```typescript
import { Did } from "@nillion/nuc";

const subscriberDid = await signer.getDid();
const status = await client.subscriptionStatus(subscriberDid, "nildb");

if (status.is_active) {
  console.log("Subscription active until:", status.expires_at);
} else {
  console.log("No active subscription");
}
```

### 3. Create Payment Resource

Before making an on-chain payment, create the payment resource:

```typescript
const subscriberDid = await subscriberSigner.getDid();
const payerDid = await payerSigner.getDid();

const { resourceHash, payload } = client.createPaymentResource(subscriberDid, "nildb", payerDid);

// Use resourceHash as the digest parameter for the on-chain BurnWithDigest call
```

### 4. Validate Payment

After the on-chain transaction completes:

```typescript
await client.validatePayment(txHash, payload, payerSigner);
```

## Token Management

### Request a Root Token

Once a subscription is active, request a root NUC token:

```typescript
const response = await client.requestToken(subscriberSigner, "nildb");
console.log("Token:", response.token);
```

### Check for Revoked Tokens

Before using a token, verify it hasn't been revoked:

```typescript
import { Codec } from "@nillion/nuc";

const envelope = Codec._unsafeDecodeBase64Url(tokenString);
const revocations = await client.findRevocationsInProofChain(envelope);

if (revocations.tokens.length > 0) {
  console.log("Token chain contains revoked tokens:", revocations.tokens);
}
```

### Revoke a Token

To revoke a token you have authority over:

```typescript
await client.revokeToken({
  signer: ownerSigner,
  authToken: authorizationEnvelope,
  tokenToRevoke: tokenEnvelope,
});
```

## Health Checks

### Instance Health Check

```typescript
const health = await client.health();
console.log("Service status:", health.status);
```

### Static Health Check

Check a service without creating a full client:

```typescript
const health = await NilauthClient.health("https://nilauth.example.com");
console.log("Service status:", health.status);
```

## Error Handling

The library provides specific error types for different failure scenarios:

```typescript
import { NilauthErrorResponse, NilauthUnreachable } from "@nillion/nilauth-client";

try {
  const token = await client.requestToken(signer, "nildb");
} catch (error) {
  if (error instanceof NilauthErrorResponse) {
    // Service returned an error response
    console.error(`Error ${error.errorCode}: ${error.message}`);
    console.error(`HTTP Status: ${error.statusCode}`);
  } else if (error instanceof NilauthUnreachable) {
    // Could not reach the service
    console.error(`Service unreachable at ${error.url}`);
  } else {
    throw error;
  }
}
```

## Logging

Control log verbosity for debugging:

```typescript
import { setLogLevel, getLogLevel, clearStoredLogLevel } from "@nillion/nilauth-client";

// Set log level
setLogLevel("debug");

// Get current level
console.log("Current level:", getLogLevel());

// Clear stored preference
clearStoredLogLevel();
```

Or via environment variable:

```bash
NILLION_LOG_LEVEL=debug node your-app.js
```
