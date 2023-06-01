import { ethers } from "hardhat";
import { DAOFactory, TimeLock } from "../typechain-types";
import * as fs from "fs";
import { deploymentsFile } from "../helper-config";

export async function setupRoles() {
  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const daoFactory = (await ethers.getContractAt(
    "DAOFactory",
    data.daoFactory
  )) as DAOFactory;
  const count = (await daoFactory.getDAOCount()).toNumber();

  const timeLock = (await ethers.getContractAt(
    "TimeLock",
    data[count]["timeLock"]
  )) as TimeLock;

  const proposerRole = await timeLock.PROPOSER_ROLE();
  const executorRole = await timeLock.EXECUTOR_ROLE();
  const adminRole = await timeLock.TIMELOCK_ADMIN_ROLE();

  console.log("Setting up roles...");
  const proposerTx = await timeLock.grantRole(
    proposerRole,
    data.organizationGovernance
  );
  await proposerTx.wait();
  console.log("Granted proposer role to organization governance contract");

  const executorTx = await timeLock.grantRole(
    executorRole,
    data.organizationGovernance
  );
  await executorTx.wait();
  console.log("Granted executor role to organization governance contract");

  const adminTx = await timeLock.revokeRole(adminRole, deployerAddress);
  await adminTx.wait();
  console.log("Revoked admin role from deployer");
}

setupRoles().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
