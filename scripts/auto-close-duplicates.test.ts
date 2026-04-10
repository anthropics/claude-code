import { expect, test, describe, spyOn, mock, afterEach } from "bun:test";
import { githubRequest } from "./auto-close-duplicates";

describe("githubRequest", () => {
  afterEach(() => {
    mock.restore();
  });

  test("makes successful GET request with correct headers", async () => {
    const mockData = { id: 1, name: "test" };
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await githubRequest("/test-endpoint", "fake-token");

    expect(result).toEqual(mockData);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const url = fetchSpy.mock.calls[0][0];
    const options = fetchSpy.mock.calls[0][1];

    expect(url).toBe("https://api.github.com/test-endpoint");
    expect(options?.method).toBe("GET");
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer fake-token",
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "auto-close-duplicates-script",
    });
    // Shouldn't have Content-Type or body for GET without body
    expect(options?.headers).not.toHaveProperty("Content-Type");
    expect(options?.body).toBeUndefined();
  });

  test("makes successful POST request with body and Content-Type header", async () => {
    const mockResponse = { success: true };
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const requestBody = { title: "Test Issue" };
    const result = await githubRequest(
      "/issues",
      "fake-token",
      "POST",
      requestBody,
    );

    expect(result).toEqual(mockResponse);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const options = fetchSpy.mock.calls[0][1];

    expect(options?.method).toBe("POST");
    expect(options?.headers).toMatchObject({
      Authorization: "Bearer fake-token",
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "auto-close-duplicates-script",
      "Content-Type": "application/json",
    });
    expect(options?.body).toBe(JSON.stringify(requestBody));
  });

  test("throws error when response is not ok", async () => {
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Not Found", {
        status: 404,
        statusText: "Not Found",
      }),
    );

    await expect(githubRequest("/nonexistent", "fake-token")).rejects.toThrow(
      "GitHub API request failed: 404 Not Found",
    );
  });
});
