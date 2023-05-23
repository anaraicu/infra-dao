import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { MIN_DELAY, VOTING_DELAY } from "../helper-config";
import { ContractFactory } from "ethers";
import { ethers, upgrades } from "hardhat";
import { TimeLock } from "../typechain-types";

const deployTimeLock: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("Deploying TimeLock...");
  const timeLockFactory: ContractFactory = await ethers.getContractFactory(
    "TimeLock"
  );
  const timeLock = (await upgrades.deployProxy(
    timeLockFactory,
    [VOTING_DELAY, [], [], deployer],
    { initializer: "initialize" }
  )) as TimeLock;
  await timeLock.deployed();
  // const timeLock = await deploy("TimeLock", {
  //   from: deployer,
  //   args: [MIN_DELAY, [], [], deployer],
  //   log: true,
  // });

  log(`Deployed TimeLock to address ${timeLock.address}`);
};

export default deployTimeLock;
