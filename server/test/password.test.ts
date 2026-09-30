import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, verifyPassword } from "../src/security/password.js";

describe("password hashing (scrypt)", () => {
  it("بيتحقق صح لما كلمة السر مطابقة", () => {
    const stored = hashPassword("Passw0rd!");
    assert.equal(verifyPassword("Passw0rd!", stored), true);
  });

  it("بيرفض لما كلمة السر غلط", () => {
    const stored = hashPassword("Passw0rd!");
    assert.equal(verifyPassword("WrongPass!", stored), false);
  });

  it("الـ Hash المخزّن مش نفس كلمة السر الأصلية إطلاقًا (Plaintext)", () => {
    const stored = hashPassword("Passw0rd!");
    assert.equal(stored.includes("Passw0rd!"), false);
  });

  it("نفس كلمة السر بترجع Hash مختلف كل مرة (Salt عشوائي)", () => {
    const a = hashPassword("Passw0rd!");
    const b = hashPassword("Passw0rd!");
    assert.notEqual(a, b);
  });
});
