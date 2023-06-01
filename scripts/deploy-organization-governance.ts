import { ethers } from "hardhat";
import { ContractFactory } from "ethers";
import { OrganizationGovernance } from "../typechain-types";
import * as fs from "fs";
import {
  deploymentsFile,
  PROPOSAL_THRESHOLD,
  QUORUM_PERCENTAGE,
  VOTING_PERIOD,
} from "../helper-config";

export async function deployOrganizationGovernance(
  votingPeriod: number,
  quorumPercentage: number,
  proposalThreshold: number
) {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const content = fs.readFileSync(deploymentsFile, "utf8");
  const data = JSON.parse(content);

  const organizationGovernanceFactory: ContractFactory =
    await ethers.getContractFactory("OrganizationGovernance");
  const organizationGovernance = await organizationGovernanceFactory.deploy();

  console.log(
    "Organization Governance deployed to:",
    organizationGovernance.address
  );
  data.organizationGovernance = organizationGovernance.address;

  fs.writeFileSync(deploymentsFile, JSON.stringify(data, null, 2));
  console.log("Updated deployments.json file successfully.");
}

deployOrganizationGovernance(
  VOTING_PERIOD,
  QUORUM_PERCENTAGE,
  PROPOSAL_THRESHOLD
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
