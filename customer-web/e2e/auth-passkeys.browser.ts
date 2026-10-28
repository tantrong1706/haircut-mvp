import { createRequire } from "node:module";
import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

// Reuse the actual backend verifier, not a mock or a second cryptographic implementation.
const verifier = createRequire(new URL("../../firebase/functions/package.json", import.meta.url))(
  "@simplewebauthn/server",
);

test("real WebAuthn registration/sign-in verifies signatures and rejects wrong origin, RP and signature", async ({
  page,
  context,
}) => {
  await page.route("**/passkey-harness", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html lang='vi'><title>Isolated passkey test</title><body>Passkey verification harness</body></html>",
    }),
  );
  await page.goto("/passkey-harness");
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  try {
    const registrationOptions = await verifier.generateRegistrationOptions({
      rpName: "CH Hair isolated test",
      rpID: "localhost",
      userName: "synthetic-customer",
      userID: new Uint8Array(32).fill(7),
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      supportedAlgorithmIDs: [-7],
      attestationType: "none",
    });
    const registration = await page.evaluate(async (optionsJSON) => {
      const moduleUrl = "/node_modules/@simplewebauthn/browser/esm/index.js";
      const sdk = await import(moduleUrl);
      return sdk.startRegistration({ optionsJSON });
    }, registrationOptions);
    const registered = await verifier.verifyRegistrationResponse({
      response: registration,
      expectedChallenge: registrationOptions.challenge,
      expectedOrigin: "http://localhost:4177",
      expectedRPID: "localhost",
      requireUserVerification: true,
    });
    expect(registered.verified).toBe(true);
    const options = await verifier.generateAuthenticationOptions({
      rpID: "localhost",
      userVerification: "required",
    });
    const assertion = await page.evaluate(async (optionsJSON) => {
      const moduleUrl = "/node_modules/@simplewebauthn/browser/esm/index.js";
      const sdk = await import(moduleUrl);
      return sdk.startAuthentication({ optionsJSON });
    }, options);
    const input = {
      response: assertion,
      expectedChallenge: options.challenge,
      expectedOrigin: "http://localhost:4177",
      expectedRPID: "localhost",
      credential: registered.registrationInfo.credential,
      requireUserVerification: true,
    };
    expect((await verifier.verifyAuthenticationResponse(input)).verified).toBe(true);
    await expect(
      verifier.verifyAuthenticationResponse({ ...input, expectedOrigin: "https://wrong.example" }),
    ).rejects.toThrow();
    await expect(
      verifier.verifyAuthenticationResponse({ ...input, expectedRPID: "wrong.example" }),
    ).rejects.toThrow();
    const signature = Buffer.from(assertion.response.signature, "base64url");
    signature[0] ^= 1;
    await expect(
      verifier.verifyAuthenticationResponse({
        ...input,
        response: {
          ...assertion,
          response: { ...assertion.response, signature: signature.toString("base64url") },
        },
      }),
    ).rejects.toThrow();
  } finally {
    await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    await cdp.detach();
  }
});
