import { NilauthClient } from "#/client";
import { NilauthUnreachable } from "#/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock ky - keep HTTPError real for instanceof checks
vi.mock("ky", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ky")>();
  return {
    ...actual,
    default: vi.fn(),
  };
});

import ky from "ky";

const mockedKy = ky as unknown as ReturnType<typeof vi.fn>;

// Valid ed25519 public key (32 bytes hex = 64 chars)
const validPublicKey = "3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29";

function mockJsonResponse(data: unknown): Response {
  return {
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

function mockTextResponse(data: string): Response {
  return {
    headers: new Headers({ "content-type": "text/plain" }),
    json: async () => {
      throw new Error("Not JSON");
    },
    text: async () => data,
  } as unknown as Response;
}

function mockAboutResponse(): Response {
  return mockJsonResponse({
    started: "2024-01-15T08:00:00Z",
    public_key: validPublicKey,
    build: { commit: "abc123", timestamp: "2024-01-14T12:00:00Z" },
  });
}

describe("NilauthClient", () => {
  const baseUrl = "https://nilauth.example.com";
  const chainId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("create", () => {
    it("fetches about info and constructs client", async () => {
      mockedKy.mockResolvedValueOnce(mockAboutResponse());

      const client = await NilauthClient.create({ baseUrl, chainId });

      expect(mockedKy).toHaveBeenCalledOnce();
      expect(client.nilauthBaseUrl).toBe(baseUrl);
      expect(client.nilauthPublicKey).toBe(validPublicKey);
      expect(client.chainId).toBe(chainId);
    });

    it("throws NilauthUnreachable when service is down", async () => {
      mockedKy.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      await expect(NilauthClient.create({ baseUrl, chainId })).rejects.toThrow(NilauthUnreachable);
    });
  });

  describe("health", () => {
    it("returns OK on healthy service", async () => {
      mockedKy.mockResolvedValueOnce(mockAboutResponse()).mockResolvedValueOnce(mockTextResponse("OK"));

      const client = await NilauthClient.create({ baseUrl, chainId });
      const health = await client.health();

      expect(health).toBe("OK");
    });

    it("static health check works without client instance", async () => {
      mockedKy.mockResolvedValueOnce(mockTextResponse("OK"));

      const health = await NilauthClient.health(baseUrl);
      expect(health).toBe("OK");
    });
  });

  describe("subscriptionCost", () => {
    it("returns cost for blind module", async () => {
      mockedKy.mockResolvedValueOnce(mockAboutResponse()).mockResolvedValueOnce(mockJsonResponse({ cost_unils: 1000 }));

      const client = await NilauthClient.create({ baseUrl, chainId });
      const cost = await client.subscriptionCost("nildb");

      expect(cost).toBe(1000);
    });
  });

  describe("error handling", () => {
    it("throws NilauthUnreachable on network error", async () => {
      mockedKy.mockResolvedValueOnce(mockAboutResponse()).mockRejectedValueOnce(new Error("Network error"));

      const client = await NilauthClient.create({ baseUrl, chainId });

      await expect(client.subscriptionCost("nildb")).rejects.toThrow(NilauthUnreachable);
    });
  });
});
