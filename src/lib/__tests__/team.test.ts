import { describe, expect, it } from "vitest";
import { ACCOUNT_MANAGER_ROLES, INVITABLE_ROLES, canEdit, canInvite, canManage, isInvitableRole, memberChangeError } from "@/lib/domain/roles";
import { USER_ROLES } from "@/lib/types";

describe("role rules", () => {
  it("only OWNER and ADMIN can manage and invite", () => {
    for (const r of USER_ROLES) {
      const expected = r === "OWNER" || r === "ADMIN";
      expect(canManage(r)).toBe(expected);
      expect(canInvite(r)).toBe(expected);
    }
  });

  it("everyone except VIEWER can edit", () => {
    expect(USER_ROLES.filter((r) => !canEdit(r))).toEqual(["VIEWER"]);
  });

  it("OWNER is never invitable", () => {
    expect(INVITABLE_ROLES).not.toContain("OWNER");
    expect(isInvitableRole("OWNER")).toBe(false);
    expect(isInvitableRole("SALES")).toBe(true);
    expect(isInvitableRole("ROOT")).toBe(false);
    expect(ACCOUNT_MANAGER_ROLES).not.toContain("VIEWER");
  });
});

describe("memberChangeError", () => {
  const admin = { id: "a", role: "ADMIN" as const };
  it("allows an admin to change a finance member to sales", () => {
    expect(memberChangeError(admin, { id: "b", role: "FINANCE" }, "SALES")).toBeNull();
    expect(memberChangeError(admin, { id: "b", role: "FINANCE" })).toBeNull();
  });
  it("rejects non-managers, missing targets, the owner, yourself and bad roles", () => {
    expect(memberChangeError({ id: "f", role: "FINANCE" }, { id: "b", role: "SALES" }, "VIEWER")).toBe("forbidden");
    expect(memberChangeError(admin, null)).toBe("not_found");
    expect(memberChangeError(admin, { id: "o", role: "OWNER" }, "ADMIN")).toBe("owner");
    expect(memberChangeError(admin, { id: "a", role: "ADMIN" }, "FINANCE")).toBe("self");
    expect(memberChangeError(admin, { id: "b", role: "SALES" }, "OWNER")).toBe("invalid_role");
  });
});
