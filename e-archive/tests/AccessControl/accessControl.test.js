// In this test I had an error  because Jest mocked the User model, and that mock didn’t retain the Sequelize.Model class behavior. So when Sequelize tries to run .belongsTo(User), it throws the error because it's no longer dealing with a true Sequelize model.

// ✅ So to directly answer your question:
// Is moving the association setup outside the test scope a best practice or just a workaround?

// It's actually both:

// ✅ 1. Best Practice for Code Structure
// Moving association setup into a dedicated associations.js file and calling it in your app’s entry point (e.g., app.js, server.js, or index.js) is a widely accepted and clean architectural pattern in Sequelize projects.

const updateUserPermissions = require("../../services/AccessControl/accessControl.service");
const User = require("../../model/user");
const Auths = require("../../model/authorizations");

jest.mock("../../model/user");
jest.mock("../../model/authorizations");

describe("updateUserPermissions", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should throw an error if no users are found", async () => {
    User.findAll.mockResolvedValue([]);

    await expect(
      updateUserPermissions("nonexistentUser", { admin: true })
    ).rejects.toThrow("No users found.");
  });

  it("should update permissions for a single user with admin role", async () => {
    const mockUser = { id: 1, username: "adminUser" };
    const mockAuthRecord = { update: jest.fn() };

    User.findAll.mockResolvedValue([mockUser]);
    Auths.findOne.mockResolvedValue(mockAuthRecord);

    const roles = { admin: true, supervisor: false, personnel: false };

    const result = await updateUserPermissions("adminUser", roles);

    expect(User.findAll).toHaveBeenCalledWith({
      where: { username: ["adminUser"] },
    });
    expect(Auths.findOne).toHaveBeenCalledWith({ where: { userId: 1 } });
    expect(mockAuthRecord.update).toHaveBeenCalledWith({
      scanning: true,
      archiving: true,
      view_upload: true,
      supervision_right: true,
      email_notification: true,
      canViewOwnFiles: true,
      canViewDepartmentFiles: true,
      canViewBranchFiles: true,
      can_delete: true,
      is_admin: true,
    });
    expect(result).toBe("1 user(s) permissions updated successfully.");
  });

  it("should create a new authorization record if none exists", async () => {
    const mockUser = { id: 2, username: "newUser" };

    User.findAll.mockResolvedValue([mockUser]);
    Auths.findOne.mockResolvedValue(null);
    Auths.create.mockResolvedValue({});

    const roles = { admin: false, supervisor: true, personnel: false };

    const result = await updateUserPermissions("newUser", roles);

    expect(Auths.create).toHaveBeenCalledWith({
      userId: 2,
      scanning: true,
      archiving: true,
      view_upload: true,
      supervision_right: true,
      email_notification: true,
      canViewOwnFiles: true,
      canViewDepartmentFiles: true,
      canViewBranchFiles: false,
      can_delete: false,
      is_admin: false,
    });
    expect(result).toBe("1 user(s) permissions updated successfully.");
  });

  it("should update permissions for multiple users", async () => {
    const mockUsers = [
      { id: 3, username: "user1" },
      { id: 4, username: "user2" },
    ];
    const mockAuthRecord1 = { update: jest.fn() };
    const mockAuthRecord2 = { update: jest.fn() };

    User.findAll.mockResolvedValue(mockUsers);
    Auths.findOne
      .mockResolvedValueOnce(mockAuthRecord1)
      .mockResolvedValueOnce(mockAuthRecord2);

    const roles = { admin: false, supervisor: false, personnel: true };

    const result = await updateUserPermissions(
      ["user1", "user2"],
      roles
    );

    expect(User.findAll).toHaveBeenCalledWith({
      where: { username: ["user1", "user2"] },
    });
    expect(Auths.findOne).toHaveBeenCalledTimes(2);
    expect(mockAuthRecord1.update).toHaveBeenCalledWith({
      scanning: true,
      archiving: true,
      view_upload: true,
      supervision_right: false,
      email_notification: true,
      canViewOwnFiles: true,
      canViewDepartmentFiles: false,
      canViewBranchFiles: false,
      can_delete: false,
      is_admin: false,
    });
    expect(mockAuthRecord2.update).toHaveBeenCalledWith({
      scanning: true,
      archiving: true,
      view_upload: true,
      supervision_right: false,
      email_notification: true,
      canViewOwnFiles: true,
      canViewDepartmentFiles: false,
      canViewBranchFiles: false,
      can_delete: false,
      is_admin: false,
    });
    expect(result).toBe("2 user(s) permissions updated successfully.");
  });
});