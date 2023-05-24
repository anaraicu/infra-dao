// write a deployment script for quadratic governance contract
// similar to 04-deploy-organization-governance.ts
//

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import {
  PROPOSAL_THRESHOLD,
  QUORUM_PERCENTAGE,
  VOTING_PERIOD,
} from "../helper-config";

const governanceTokenAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const membershipNFTAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const timeLockAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
const organizationGovernanceAddress =
  "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";
import { OrganizationGovernance } from "../typechain-types";
const deployQuadraticGovernor: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  log(`Deploying Governor`);

  const quadraticGovernanceFactory = await ethers.getContractFactory(
    "QuadraticGovernance"
  );
  const quadraticGovernance = await upgrades.deployProxy(
    quadraticGovernanceFactory,
    [
      governanceTokenAddress,
      membershipNFTAddress,
      timeLockAddress,
      VOTING_PERIOD,
      QUORUM_PERCENTAGE,
      PROPOSAL_THRESHOLD,
      organizationGovernanceAddress,
    ],
    { initializer: "initialize" }
  );

  log(
    `Deployed Quadratic Governance to address ${quadraticGovernance.address}`
  );
};
export default deployQuadraticGovernor;
