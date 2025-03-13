---
name: Pre-Release Checklist
about: Ensure all pre-release tasks are completed before a new version is released.
title: "Pre-Release Checklist - vX.Y.Z"
labels: ["pre-release", "release-checklist"]
assignees: ["@coodos", "@SoSweetHam"]
---

## **Pre-Release Checklist**

_(Must be approved by at least two reviewers before merging the release PR)_

### **1. Code & Build Verification**

- [ ] Feature branches merged into main/stable branch
- [ ] All merge conflicts resolved
- [ ] Version number updated in `package.json`
- [ ] Build completes successfully without errors
- [ ] Code linting & formatting checks passed

### **2. Testing & QA**

- [ ] End-to-end (E2E) tests passed
- [ ] Manual testing done for critical features
- [ ] Regression testing completed
- [ ] No major or high-priority bugs remaining

### **4. Deployment & Rollback Plan**

- [ ] Deployment process tested in staging/pre-production
- [ ] Rollback strategy documented and tested
- [ ] Monitoring and alerting configured
- [ ] Infrastructure scaling verified (if applicable)

### **5. Manual Sanity Checks in Staging**

- [ ] Can create an **organization** using **DID login**
- [ ] Can create an **organization** using **email login**
- [ ] Can **subscribe to a plan** successfully
- [ ] Can **issue a credential**
- [ ] Can **receive a credential in an identity wallet**

**After all items are checked, this issue should be closed automatically when the release PR is merged.** 🚀
