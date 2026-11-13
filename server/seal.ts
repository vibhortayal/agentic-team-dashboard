// Lock a key so only GitHub can open it, before it leaves this computer.
//
// GitHub asks for secrets locked with the project's public key, using libsodium's "sealed box":
// a one-time key pair, a nonce made from both public keys, and NaCl's box. tweetnacl does the box
// and @noble/hashes the BLAKE2b nonce; both are small, audited and have no dependencies.

import nacl from "tweetnacl";
import { blake2b } from "@noble/hashes/blake2.js";

/** The value locked with GitHub's public key (base64 in, base64 out), as GitHub's API wants it. */
export function seal(value: string, publicKeyB64: string): string {
  const pk = Buffer.from(publicKeyB64, "base64");
  if (pk.length !== nacl.box.publicKeyLength) throw new Error("GitHub sent a key the board can't use.");
  const once = nacl.box.keyPair();
  const nonce = blake2b(new Uint8Array([...once.publicKey, ...pk]), { dkLen: nacl.box.nonceLength });
  const boxed = nacl.box(new TextEncoder().encode(value), nonce, new Uint8Array(pk), once.secretKey);
  once.secretKey.fill(0);
  return Buffer.concat([once.publicKey, boxed]).toString("base64");
}

/** A long random value, for settings the team only needs to be secret and unguessable. */
export function randomValue(): string {
  return Buffer.from(nacl.randomBytes(32)).toString("base64url");
}
