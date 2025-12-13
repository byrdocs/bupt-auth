import { getUserRoles, login, refresh, Role } from ".";
import { describe, test, expect } from "bun:test";
import { getTestAccount } from "./utils";


describe("login", () => {
  test("should login successfully", async () => {
    const { bupt_id, bupt_pass } = await getTestAccount();
    const res = await login(bupt_id, bupt_pass);
    expect(res.account).toEqual(bupt_id);
    expect(res).toHaveProperty("user_name");
    expect(res).toHaveProperty("real_name");
  });

  test("should throw error when login failed", async () => {
    try {
      const year = new Date().getFullYear() - 1;
      const serial = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(4, "0");
      const account = `${year}21${serial}`;
      await login(account, "wrongpassword");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
});

describe("refresh", () => {
  test("should refresh successfully", async () => {
    const { bupt_id, bupt_pass } = await getTestAccount();
    const res = await login(bupt_id, bupt_pass);
    const refresh_token = res.refresh_token;
    const refreshed = await refresh(refresh_token, Role.Student);
    expect(refreshed.account).toEqual(bupt_id);
    expect(refreshed.account).toEqual(res.account);
    expect(refreshed.real_name).toEqual(res.real_name);
    expect(refreshed).toHaveProperty("access_token");
  });

  test("should throw error when refresh failed", async () => {
    try {
      await refresh("wrongtoken");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
    }
  });
});

describe("getUserRoles", () => {
  test("should get user roles successfully", async () => {
    const { bupt_id, bupt_pass } = await getTestAccount();
    const res = await login(bupt_id, bupt_pass);
    const roles = await getUserRoles(res.refresh_token);
    expect(roles).toBeInstanceOf(Array);
    expect(roles.length).toBeGreaterThan(0);
  });
});