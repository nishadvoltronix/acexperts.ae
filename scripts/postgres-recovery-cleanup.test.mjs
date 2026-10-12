import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanupRecoveryResources } from "./helpers/recovery-cleanup.mjs";

const operationNames = ["closeStores", "closeRuntime", "closeRestored", "dropRestoreDatabase",
  "removeFixtures", "removeRuntimeRole", "restoreHba", "closeAdmin"];

function operationsWithFailures(failures, completed) {
  return Object.fromEntries(operationNames.map((name) => [name, async () => {
    completed.push(name);
    if (failures.includes(name)) throw new Error("synthetic-private-connection-details");
  }]));
}

test("recovery cleanup restores HBA and closes admin after database deletion fails", async () => {
  const completed = [];
  const result = await cleanupRecoveryResources(operationsWithFailures(["dropRestoreDatabase"], completed));
  assert.deepEqual(completed, operationNames);
  assert.deepEqual(result, { cleanup: false, failed: ["dropRestoreDatabase"] });
  assert.ok(!JSON.stringify(result).includes("synthetic-private-connection-details"));
});

test("recovery cleanup still restores HBA after pool and role cleanup failures", async () => {
  const completed = [];
  const result = await cleanupRecoveryResources(operationsWithFailures(["closeRuntime", "removeRuntimeRole"], completed));
  assert.deepEqual(completed, operationNames);
  assert.deepEqual(result, { cleanup: false, failed: ["closeRuntime", "removeRuntimeRole"] });
});

test("recovery cleanup records HBA restoration failure and still closes the admin pool", async () => {
  const completed = [];
  const result = await cleanupRecoveryResources(operationsWithFailures(["restoreHba"], completed));
  assert.deepEqual(completed, operationNames);
  assert.deepEqual(result, { cleanup: false, failed: ["restoreHba"] });
});

test("recovery cleanup succeeds only when every cleanup operation completes", async () => {
  const completed = [];
  const result = await cleanupRecoveryResources(operationsWithFailures([], completed));
  assert.deepEqual(completed, operationNames);
  assert.deepEqual(result, { cleanup: true, failed: [] });
});
