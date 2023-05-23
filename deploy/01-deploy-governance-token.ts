import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { min } from "hardhat/internal/util/bigint";
import { ContractFactory } from "ethers";
import { GovernanceToken } from "../typechain-types";

// Deploy functions that will run with hardhat
const deployGovernanceToken: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  console.log("Deploying Governance Token... ");
  const { getNamedAccounts, deployments, network } = hre;
  // import accounts from hardhat config right into deploy script
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts(); // always the 0th
  log("Deploying Governance Token... ");

  const governanceTokenFactory: ContractFactory =
    await ethers.getContractFactory("GovernanceToken");
  const governanceToken = (await upgrades.deployProxy(
    governanceTokenFactory,
    [],
    { initializer: "initialize" }
  )) as GovernanceToken;
  await governanceToken.deployed();

  // const governanceToken = await deploy("GovernanceToken", {
  //   from: deployer,
  //   log: true,
  //   // waitConfirmations: auto-verify - wait some amount of blocks before verify
  //   // waitConfirmations: networkConfig[network.name].confirmations || 1,
  // });
  // verify - on etherscan - github repo
  log(`Deployed Governance Token to address ${governanceToken.address}`);
  await delegate(governanceToken.address, deployer);
  log(`Delegated`);
};

// Add a delegate function
// When you deploy this without delegate nobody has voting power because no one has their token delegated to them
const delegate = async (
  // delegate function
  governanceTokenAddress: string,
  delegatedAccount: string
) => {
  const governanceToken = await ethers.getContractAt(
    "GovernanceToken",
    governanceTokenAddress
  );

  // Take my votes and do whatever you want

  const tx = await governanceToken.delegate(delegatedAccount);
  await tx.wait(1);
  // in ERC20 Votes there is numCheckpoints account has
  // doing votes is based on checkpoints,
  // at checkpoint x this is what everyone has as VP (voting power)
  console.log(
    `Checkpoints ${await governanceToken.numCheckpoints(delegatedAccount)}`
  );
};

export default deployGovernanceToken;
