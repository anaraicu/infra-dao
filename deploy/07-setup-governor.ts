import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { ZERO_ADDRESS } from "../helper-config";

const timeLockAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
const organizationGovernanceAddress = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";
const deploySetupContracts: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { getNamedAccounts, deployments } = hre;
  const { log } = deployments;
  const { deployer } = await getNamedAccounts();
  const governorOrganization = await ethers.getContractAt(
    "OrganizationGovernance",
    organizationGovernanceAddress
  );

  const timeLock = await ethers.getContractAt("TimeLock", timeLockAddress);

  log("Setting up roles...");
  // get bytecodes of different roles -- from TimeLockController
  // in the end we do not want any TimeLock admin role -- for decentralization
  const proposerRole = await timeLock.PROPOSER_ROLE();
  const executorRole = await timeLock.EXECUTOR_ROLE();
  const adminRole = await timeLock.TIMELOCK_ADMIN_ROLE();

  log(
    "----------------------------------------------------------------------------------------------"
  );
  log("Setting up contracts for roles...");
  const proposerTx = await timeLock.grantRole(proposerRole, governorOrganization.address);
  await proposerTx.wait(1);

  const proposerTx2 = await timeLock.grantRole(
    proposerRole,
    governorOrganization.address
  );
  await proposerTx2.wait(1);

  log("Granted Proposer Roles...");
  // give executor role to nobody=everybody
  const executorTx = await timeLock.grantRole(executorRole, ZERO_ADDRESS);
  await executorTx.wait(1);
  log("Granted Executor Role...");

  // gave everyone access revoke admin role
  const revokeTx = await timeLock.revokeRole(adminRole, deployer);
  await revokeTx.wait(1);
  log("Revoked Admin Role...");
  log(
    "----------------------------------------------------------------------------------------------"
  );
};

export default deploySetupContracts;
