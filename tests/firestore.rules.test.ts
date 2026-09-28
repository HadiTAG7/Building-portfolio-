/**
 * Security-rules tests for the team library. They need the Firestore emulator:
 *   npm run test:rules
 * and are skipped by the regular `npm test`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const suite = emulator ? describe : describe.skip;

suite("firestore.rules — portfolios", () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, port] = (emulator ?? "127.0.0.1:8080").split(":");
    env = await initializeTestEnvironment({
      projectId: "demo-portfolio",
      firestore: { rules: readFileSync(join(__dirname, "..", "firestore.rules"), "utf8"), host, port: Number(port) },
    });
  });

  afterAll(async () => {
    await env?.cleanup();
  });

  beforeEach(async () => {
    await env.clearFirestore();
  });

  const valid = (uid: string) => ({
    v: 1,
    name: "نمو فائق 1",
    author: "Hadi",
    weights: { SPTE: 45, HLAL: 35, KSA: 5, SPWO: 10, IBIT: 5 },
    ownerUid: uid,
    createdAt: serverTimestamp(),
  });

  it("anyone can read the library", async () => {
    const guest = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(collection(guest, "portfolios")));
  });

  it("signed-in users can add their own portfolio", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertSucceeds(addDoc(collection(db, "portfolios"), valid("alice")));
  });

  it("guests cannot write", async () => {
    const guest = env.unauthenticatedContext().firestore();
    await assertFails(addDoc(collection(guest, "portfolios"), valid("alice")));
  });

  it("cannot save on behalf of someone else", async () => {
    const db = env.authenticatedContext("mallory").firestore();
    await assertFails(addDoc(collection(db, "portfolios"), valid("alice")));
  });

  it("rejects unexpected fields, empty weights, long names and client timestamps", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(addDoc(collection(db, "portfolios"), { ...valid("alice"), admin: true }));
    await assertFails(addDoc(collection(db, "portfolios"), { ...valid("alice"), weights: {} }));
    await assertFails(addDoc(collection(db, "portfolios"), { ...valid("alice"), name: "x".repeat(61) }));
    await assertFails(addDoc(collection(db, "portfolios"), { ...valid("alice"), note: "x".repeat(281) }));
    await assertFails(addDoc(collection(db, "portfolios"), { ...valid("alice"), createdAt: new Date(0) }));
    await assertFails(addDoc(collection(db, "portfolios"), { ...valid("alice"), v: 2 }));
  });

  it("only the owner can delete, and nobody can edit in place", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "portfolios/p1"), { ...valid("alice"), createdAt: new Date() });
    });
    const alice = env.authenticatedContext("alice").firestore();
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(updateDoc(doc(alice, "portfolios/p1"), { name: "renamed" }));
    await assertFails(deleteDoc(doc(bob, "portfolios/p1")));
    await assertSucceeds(deleteDoc(doc(alice, "portfolios/p1")));
  });

  it("everything outside /portfolios is closed", async () => {
    const db = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "other/x"), { a: 1 }));
    await assertFails(getDocs(collection(db, "other")));
  });
});
