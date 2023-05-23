// write a deployment script for quadratic governance contract
// similar to 04-deploy-organization-governance.ts
//

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  PROPOSAL_THRESHOLD,
  QUORUM_PERCENTAGE,
  VOTING_PERIOD,
} from "../helper-config";
import { OrganizationGovernance } from "../typechain-types";
const deployQuadraticGovernor: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const governanceToken = await get("GovernanceToken");
  const membershipNFT = await get("MembershipNFT");
  const timeLock = await get("TimeLock");
  const governorOrganization = await get("OrganizationGovernance");

  log(`Deploying Governor`);

  const governorContract = await deploy("QuadraticGovernance", {
    from: deployer,
    args: [
      governanceToken.address,
      membershipNFT.address,
      timeLock.address,
      VOTING_PERIOD,
      QUORUM_PERCENTAGE,
      PROPOSAL_THRESHOLD,
      governorOrganization.address,
    ],
    log: true,
  });

  log(`Deployed Quadratic Governance to address ${governorContract.address}`);
};
export default deployQuadraticGovernor;
