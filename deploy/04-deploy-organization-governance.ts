import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
  PROPOSAL_THRESHOLD,
  QUORUM_PERCENTAGE,
  VOTING_PERIOD,
} from "../helper-config";
import { ethers, upgrades } from "hardhat";
import { address } from "hardhat/internal/core/config/config-validation";
import { ContractFactory } from "ethers";
import { OrganizationGovernance } from "../typechain-types";
import {time} from "@nomicfoundation/hardhat-network-helpers";

const deployGovernorContract: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log, get } = deployments;
  const { deployer, account } = await getNamedAccounts();
  const governanceTokenAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const membershipNFTAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  const timeLockAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";

  log(`Deploying DAO Governor`);
  // const governorContract = await deploy("OrganizationGovernance", {
  //   from: deployer,
  //   args: [
  //     governanceToken.address,
  //     membershipNFT.address,
  //     timeLock.address,
  //     VOTING_PERIOD,
  //     QUORUM_PERCENTAGE,
  //     PROPOSAL_THRESHOLD,
  //   ],
  //   log: true,
  // });
  const organizationGovernanceFactory: ContractFactory =
    await ethers.getContractFactory("OrganizationGovernance");
  const organizationGovernance = (await upgrades.deployProxy(
    organizationGovernanceFactory,
    [
      governanceTokenAddress,
      membershipNFTAddress,
      timeLockAddress,
      VOTING_PERIOD,
      QUORUM_PERCENTAGE,
      PROPOSAL_THRESHOLD,
    ],
    { initializer: "initialize" }
  )) as OrganizationGovernance;

  log(`Deployed DAO Governance to address ${organizationGovernance.address}`);
  log(
    `-------------------------------------------------------------------------------`
  );
  const governance = await ethers.getContractAt(
    "OrganizationGovernance",
    organizationGovernance.address
  );
  // TODO: See here if they update correctly
  // const governance = await ethers.getContract("Governance");
  let proposalThreshold = await governance.proposalThreshold();
  let quorumFraction = await governance.getQuorumNumerator();
  let votingPeriod = await governance.votingPeriod();

  log(`Proposal Threshold: ${proposalThreshold}`);
  log(`Quorum Fraction: ${quorumFraction}`);
  log(`Voting Period: ${votingPeriod}`);

  log(
    `DAO Governance address got: ${governance.address}, expected ${organizationGovernance.address}`
  );

  log(
    `-------------------------------------------------------------------------------`
  );
};
export default deployGovernorContract;
