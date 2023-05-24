import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, upgrades } from "hardhat";
import { getContract } from "@nomiclabs/hardhat-ethers/internal/helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const timeLockAddress = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
const organizationGovernanceAddress =
  "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";

const deployBox: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const simpleGovernance = await ethers.getContractAt(
    "OrganizationGovernance",
    organizationGovernanceAddress
  );
  const timeLock = await ethers.getContractAt("TimeLock", timeLockAddress);
  log("Deploying Box...");
  const BoxFactory = await ethers.getContractFactory("Box");
  const box = await upgrades.deployProxy(BoxFactory, [timeLock.address], {
    initializer: "initialize",
  });
  await box.deployed();
  log(`Box deployed to: ${box.address}`);

  // want to give the box's ownership over the governance process
  const boxContract = await ethers.getContractAt("Box", box.address);

  // const transferOwnerTx = await boxContract.transferOwnership(timeLock.address);
  // await transferOwnerTx.wait(1);
  log("DONE");
};

export default deployBox;
